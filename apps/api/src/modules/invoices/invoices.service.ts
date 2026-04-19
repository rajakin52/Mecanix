import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AgtService } from '../agt/agt.service';
import type { GenerateInvoiceInput, PaginationInput } from '@mecanix/validators';

interface InvoiceFilters {
  status?: string;
  customerId?: string;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger('InvoicesService');

  constructor(
    private readonly supabase: SupabaseService,
    private readonly agtService: AgtService,
  ) {}

  async list(tenantId: string, pagination: PaginationInput, filters: InvoiceFilters = {}) {
    const client = this.supabase.getClient();
    const { page, pageSize } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('invoices')
      .select(
        '*, customer:customers(id, full_name), job_card:job_cards(id, job_number)',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
;

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    query = query.order('created_at', { ascending: false });

    const { data, count, error } = await query.range(from, to);

    if (error) throw error;

    return {
      data: data ?? [],
      meta: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
    };
  }

  async getById(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('invoices')
      .select('*, customer:customers(*), job_card:job_cards(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)

      .single();

    if (error || !data) {
      throw new NotFoundException('Invoice not found');
    }

    // Fetch payments
    const { data: payments } = await client
      .from('payments')
      .select('*')
      .eq('invoice_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // Fetch credit notes
    const { data: creditNotes } = await client
      .from('credit_notes')
      .select('*')
      .eq('invoice_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    return {
      ...data,
      payments: payments ?? [],
      credit_notes: creditNotes ?? [],
    };
  }

  async generateFromJobCard(
    tenantId: string,
    userId: string,
    input: GenerateInvoiceInput,
  ) {
    const client = this.supabase.getClient();

    // 1. Get job card
    const { data: jobCard, error: jobError } = await client
      .from('job_cards')
      .select('*')
      .eq('id', input.jobCardId)
      .eq('tenant_id', tenantId)

      .single();

    if (jobError || !jobCard) {
      throw new NotFoundException('Job card not found');
    }

    // Verify no planned lines remain
    const { data: plannedLines } = await client
      .from('parts_lines')
      .select('id')
      .eq('job_card_id', input.jobCardId)
      .eq('tenant_id', tenantId)
      .eq('line_status', 'planned')
      .limit(1);

    if (plannedLines && plannedLines.length > 0) {
      throw new BadRequestException(
        'Cannot generate invoice — there are planned work items that have not been charged or removed.',
      );
    }

    // 2. Get labour lines with their snapshotted tax rate — charged only
    const { data: labourLines } = await client
      .from('labour_lines')
      .select('subtotal, tax_rate')
      .eq('job_card_id', input.jobCardId)
      .eq('tenant_id', tenantId)
      .eq('line_status', 'charged');

    const labourTotal = (labourLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );

    // 3. Get parts lines with their snapshotted tax rate — charged only
    const { data: partsLines } = await client
      .from('parts_lines')
      .select('subtotal, tax_rate')
      .eq('job_card_id', input.jobCardId)
      .eq('tenant_id', tenantId)
      .eq('line_status', 'charged');

    const partsTotal = (partsLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );

    // 4. Generate invoice number via RPC
    const { data: invoiceNumber, error: rpcError } = await client.rpc(
      'generate_invoice_number',
      { p_tenant_id: tenantId },
    );

    if (rpcError) throw rpcError;

    // 5. Fetch customer tax profile (cativo + retention).
    const { data: customer } = await client
      .from('customers')
      .select('vat_captive_pct, withholds_service_retention')
      .eq('id', jobCard.customer_id)
      .eq('tenant_id', tenantId)
      .single();

    const customerCaptivePct = Number(customer?.vat_captive_pct ?? 0);
    const customerRetains = Boolean(customer?.withholds_service_retention);

    const round2 = (n: number) => Math.round(n * 100) / 100;

    // 6. Compute per-rate VAT from the line snapshots.
    const vatByRate: Record<string, number> = {};
    const addToRate = (subtotal: number, rate: number | null | undefined) => {
      if (!jobCard.is_taxable) return;
      const r = Number(rate ?? 0);
      const vat = subtotal * (r / 100);
      const key = r.toFixed(2);
      vatByRate[key] = (vatByRate[key] ?? 0) + vat;
    };
    (labourLines ?? []).forEach((l: { subtotal: number; tax_rate: number | null }) =>
      addToRate(l.subtotal || 0, l.tax_rate));
    (partsLines ?? []).forEach((p: { subtotal: number; tax_rate: number | null }) =>
      addToRate(p.subtotal || 0, p.tax_rate));

    const totalVat = Object.values(vatByRate).reduce((s, v) => s + v, 0);

    // 7. Captive VAT: portion of VAT the customer will pay directly to AGT.
    const captiveAmount = totalVat * (customerCaptivePct / 100);

    // 8. Service retention: 6.5% of the labour total, withheld by the customer.
    const retentionPct = customerRetains ? 6.5 : 0;
    const retentionAmount = labourTotal * (retentionPct / 100);

    // 9. Totals.
    const subtotal = labourTotal + partsTotal;
    const grandTotal = subtotal + totalVat;                 // full invoice
    const clientOwes = grandTotal - captiveAmount - retentionAmount; // net to us

    // 10. Round vat_by_rate values for storage
    const vatByRateRounded: Record<string, number> = {};
    for (const [k, v] of Object.entries(vatByRate)) vatByRateRounded[k] = round2(v);

    // 11. Handle insurance split (applies to the net client portion).
    let customerPortion = round2(clientOwes);
    let insurancePortion = 0;
    if (jobCard.is_insurance) {
      customerPortion = input.customerPortion != null
        ? round2(input.customerPortion)
        : round2(clientOwes);
      insurancePortion = round2(clientOwes - customerPortion);
    }

    // 12. Keep a representative top-level tax_rate for legacy reports that
    // expect a single number. Use the dominant rate if one exists, else 0.
    const legacyTaxRate = Object.entries(vatByRate)
      .sort(([, a], [, b]) => b - a)[0]?.[0];

    // 13. Insert invoice with the new fields.
    const { data: invoice, error: insertError } = await client
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
        job_card_id: input.jobCardId,
        customer_id: jobCard.customer_id,
        status: 'draft',
        labour_total: round2(labourTotal),
        parts_total: round2(partsTotal),
        subtotal: round2(subtotal),
        tax_rate: legacyTaxRate ? Number(legacyTaxRate) : 0,
        tax_amount: round2(totalVat),
        vat_by_rate: vatByRateRounded,
        vat_captive_pct: customerCaptivePct,
        iva_captive_amount: round2(captiveAmount),
        service_retention_pct: retentionPct,
        service_retention_amount: round2(retentionAmount),
        grand_total: round2(grandTotal),
        customer_portion: customerPortion,
        insurance_portion: insurancePortion,
        paid_amount: 0,
        balance_due: round2(clientOwes),
        is_insurance: jobCard.is_insurance ?? false,
        due_date: input.dueDate || null,
        notes: input.notes || null,
        footer: input.footer || null,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 8b. Generate hash chain (AGT compliance)
    try {
      const now = new Date();
      const hashResult = await this.agtService.generateDocumentHash(
        tenantId,
        'FT',
        now.toISOString().slice(0, 10),
        now.toISOString().replace(/\.\d{3}Z$/, ''),
        round2(grandTotal),
      );

      // Update invoice with hash data
      await client
        .from('invoices')
        .update({
          document_type: 'FT',
          series_id: hashResult.seriesId,
          saft_document_number: hashResult.saftDocumentNumber,
          hash: hashResult.hash,
          hash_control: hashResult.hashControl,
          short_hash: hashResult.shortHash,
          previous_hash: hashResult.previousHash,
          system_entry_date: now.toISOString(),
        })
        .eq('id', invoice.id);

      this.logger.log(`Hash generated for invoice ${invoice.invoice_number}: ${hashResult.shortHash}`);
    } catch (err) {
      // Hash generation is non-blocking — invoice is still valid without hash
      // (series may not be initialized yet)
      this.logger.warn(`Hash generation skipped for ${invoice.invoice_number}: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    // 9. Update job card status to 'invoiced'
    const currentStatus = jobCard.status as string;

    await client
      .from('job_cards')
      .update({
        status: 'invoiced',
        date_closed: new Date().toISOString(),

      })
      .eq('id', input.jobCardId)
      .eq('tenant_id', tenantId);

    // 10. Insert status history
    await client.from('job_status_history').insert({
      tenant_id: tenantId,
      job_card_id: input.jobCardId,
      from_status: currentStatus,
      to_status: 'invoiced',
      changed_by: userId,
      notes: `Invoice ${invoiceNumber} generated`,
    });

    return invoice;
  }

  async sendInvoice(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    // Verify invoice exists
    await this.getById(tenantId, id);

    const { data, error } = await client
      .from('invoices')
      .update({ status: 'sent' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // TODO: Send via email/WhatsApp

    return data;
  }

  async getFinancialSummary(tenantId: string) {
    const client = this.supabase.getClient();

    // All non-deleted, non-cancelled invoices
    const { data: invoices, error } = await client
      .from('invoices')
      .select('status, grand_total, balance_due, due_date, created_at')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled');

    if (error) throw error;

    const rows = invoices ?? [];
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const startOfWeek = new Date(now.getTime() - now.getDay() * 86400000);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfWeekISO = startOfWeek.toISOString();

    let totalReceivables = 0;
    let overdueReceivables = 0;
    let totalRevenue = 0;
    let revenueThisMonth = 0;
    let revenueThisWeek = 0;

    for (const row of rows) {
      const status = row.status as string;
      const grandTotal = (row.grand_total as number) || 0;
      const balanceDue = (row.balance_due as number) || 0;
      const dueDate = row.due_date as string | null;
      const createdAt = row.created_at as string;

      // Receivables: unpaid/partial invoices
      if (status !== 'paid' && status !== 'cancelled') {
        totalReceivables += balanceDue;

        if (dueDate && new Date(dueDate) < now) {
          overdueReceivables += balanceDue;
        }
      }

      // Revenue: paid invoices
      if (status === 'paid') {
        totalRevenue += grandTotal;

        if (createdAt >= startOfMonth) {
          revenueThisMonth += grandTotal;
        }
        if (createdAt >= startOfWeekISO) {
          revenueThisWeek += grandTotal;
        }
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;

    return {
      totalReceivables: round2(totalReceivables),
      overdueReceivables: round2(overdueReceivables),
      totalRevenue: round2(totalRevenue),
      revenueThisMonth: round2(revenueThisMonth),
      revenueThisWeek: round2(revenueThisWeek),
    };
  }
}
