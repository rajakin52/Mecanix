import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { GenerateInvoiceInput, PaginationInput } from '@mecanix/validators';

interface InvoiceFilters {
  status?: string;
  customerId?: string;
}

@Injectable()
export class InvoicesService {
  constructor(private readonly supabase: SupabaseService) {}

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

    // 2. Get labour lines
    const { data: labourLines } = await client
      .from('labour_lines')
      .select('subtotal')
      .eq('job_card_id', input.jobCardId)
      .eq('tenant_id', tenantId);

    const labourTotal = (labourLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );

    // 3. Get parts lines
    const { data: partsLines } = await client
      .from('parts_lines')
      .select('subtotal')
      .eq('job_card_id', input.jobCardId)
      .eq('tenant_id', tenantId);

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

    // 5. Get tax rate from tenant settings
    const { data: taxRateSetting } = await client
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'tax_rate')
      .single();

    const taxRate = taxRateSetting?.value ? Number(taxRateSetting.value) : 14;

    // 6. Calculate totals
    const subtotal = labourTotal + partsTotal;
    const taxAmount = jobCard.is_taxable ? subtotal * (taxRate / 100) : 0;
    const grandTotal = subtotal + taxAmount;

    const round2 = (n: number) => Math.round(n * 100) / 100;

    // 7. Handle insurance split
    let customerPortion = round2(grandTotal);
    let insurancePortion = 0;

    if (jobCard.is_insurance) {
      customerPortion = input.customerPortion != null
        ? round2(input.customerPortion)
        : round2(grandTotal);
      insurancePortion = round2(grandTotal - customerPortion);
    }

    // 8. Insert invoice
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
        tax_rate: taxRate,
        tax_amount: round2(taxAmount),
        grand_total: round2(grandTotal),
        customer_portion: customerPortion,
        insurance_portion: insurancePortion,
        paid_amount: 0,
        balance_due: round2(grandTotal),
        is_insurance: jobCard.is_insurance ?? false,
        due_date: input.dueDate || null,
        notes: input.notes || null,
        footer: input.footer || null,
        created_by: userId,

      })
      .select()
      .single();

    if (insertError) throw insertError;

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

    // All non-deleted invoices
    const { data: invoices, error } = await client
      .from('invoices')
      .select('status, grand_total, balance_due, due_date, created_at')
      .eq('tenant_id', tenantId)
;

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
