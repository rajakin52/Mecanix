import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AgtService } from '../agt/agt.service';
import type { GenerateInvoiceInput, PaginationInput, CreateStandaloneInvoiceInput, StandaloneLineInput } from '@mecanix/validators';
import { computeInvoiceTotals } from './invoice-math';

// Default expiry for a payment link = 30 days. Customer pays at pickup or
// after dunning; anything older is a dead link the shop should rotate.
const PAY_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

    // Fetch parts_lines for stand-alone invoices (no job_card). These
    // lines have invoice_id set directly. For job-card invoices we
    // leave this empty — the existing /jobs/:id/parts-lines endpoint
    // is what the detail page already uses.
    let standaloneLines: Array<Record<string, unknown>> = [];
    if (!data.job_card_id) {
      const { data: lines } = await client
        .from('parts_lines')
        .select('*')
        .eq('invoice_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });
      standaloneLines = lines ?? [];
    }

    return {
      ...data,
      payments: payments ?? [],
      credit_notes: creditNotes ?? [],
      standalone_parts_lines: standaloneLines,
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

    const totals = computeInvoiceTotals({
      labourLines: (labourLines ?? []) as Array<{ subtotal: number; tax_rate: number | null }>,
      partsLines: (partsLines ?? []) as Array<{ subtotal: number; tax_rate: number | null }>,
      customerCaptivePct,
      customerRetains,
      isTaxable: Boolean(jobCard.is_taxable),
      isInsurance: Boolean(jobCard.is_insurance),
      customerPortionOverride: input.customerPortion,
    });

    // 13. Insert invoice with the new fields.
    const { data: invoice, error: insertError } = await client
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
        job_card_id: input.jobCardId,
        customer_id: jobCard.customer_id,
        status: 'draft',
        labour_total: totals.labourTotal,
        parts_total: totals.partsTotal,
        subtotal: totals.subtotal,
        tax_rate: totals.legacyTaxRate,
        tax_amount: totals.totalVat,
        vat_by_rate: totals.vatByRate,
        vat_captive_pct: customerCaptivePct,
        iva_captive_amount: totals.captiveAmount,
        service_retention_pct: totals.retentionPct,
        service_retention_amount: totals.retentionAmount,
        grand_total: totals.grandTotal,
        customer_portion: totals.customerPortion,
        insurance_portion: totals.insurancePortion,
        paid_amount: 0,
        balance_due: totals.clientOwes,
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
        totals.grandTotal,
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

    // 9. Conditionally close the job card. Defaults to closing — the
    // common case is one final invoice per job. Partial-invoicing /
    // backorder workflows pass closeJobCard=false to keep the card
    // open so more labour/parts can still be added.
    const currentStatus = jobCard.status as string;
    const shouldClose = input.closeJobCard !== false; // undefined treated as true

    if (shouldClose) {
      await client
        .from('job_cards')
        .update({
          status: 'invoiced',
          date_closed: new Date().toISOString(),
        })
        .eq('id', input.jobCardId)
        .eq('tenant_id', tenantId);

      await client.from('job_status_history').insert({
        tenant_id: tenantId,
        job_card_id: input.jobCardId,
        from_status: currentStatus,
        to_status: 'invoiced',
        changed_by: userId,
        notes: `Invoice ${invoiceNumber} generated — job closed`,
      });
    } else {
      // Audit-log the invoice creation without changing status.
      await client.from('job_status_history').insert({
        tenant_id: tenantId,
        job_card_id: input.jobCardId,
        from_status: currentStatus,
        to_status: currentStatus,
        changed_by: userId,
        notes: `Invoice ${invoiceNumber} generated — job kept open (partial / backorder)`,
      });
    }

    return invoice;
  }

  /**
   * Stand-alone OTC parts-sale invoice — no job card, no labour, no
   * vehicle. parts_lines hang directly off the invoice via invoice_id
   * (made possible by migration 00115). Stock is deducted inline.
   */
  async createStandalone(
    tenantId: string,
    userId: string,
    input: CreateStandaloneInvoiceInput,
  ) {
    const client = this.supabase.getClient();

    // 1. Validate customer + fetch tax profile
    const { data: customer, error: custErr } = await client
      .from('customers')
      .select('id, full_name, vat_captive_pct, withholds_service_retention')
      .eq('id', input.customerId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (custErr) throw custErr;
    if (!customer) throw new NotFoundException('Customer not found');

    // 2. Resolve a default tax code for lines that don't carry one
    const { data: defaultTax } = await client
      .from('tax_codes')
      .select('id, rate')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const enriched = await this.enrichLines(tenantId, input.lines, defaultTax);

    // 3. Generate invoice number
    const { data: invoiceNumber, error: rpcErr } = await client.rpc(
      'generate_invoice_number',
      { p_tenant_id: tenantId },
    );
    if (rpcErr) throw rpcErr;

    const customerCaptivePct = Number(customer.vat_captive_pct ?? 0);
    const customerRetains = Boolean(customer.withholds_service_retention);

    const totals = computeInvoiceTotals({
      labourLines: [],
      partsLines: enriched.map((l) => ({ subtotal: l.subtotal, tax_rate: l.tax_rate })),
      customerCaptivePct,
      customerRetains,
      isTaxable: true,
      isInsurance: false,
    });

    // 4. Insert invoice (job_card_id = null thanks to migration 00115)
    const { data: invoice, error: invErr } = await client
      .from('invoices')
      .insert({
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
        job_card_id: null,
        customer_id: customer.id,
        status: 'draft',
        labour_total: 0,
        parts_total: totals.partsTotal,
        subtotal: totals.subtotal,
        tax_rate: totals.legacyTaxRate,
        tax_amount: totals.totalVat,
        vat_by_rate: totals.vatByRate,
        vat_captive_pct: customerCaptivePct,
        iva_captive_amount: totals.captiveAmount,
        service_retention_pct: totals.retentionPct,
        service_retention_amount: totals.retentionAmount,
        grand_total: totals.grandTotal,
        customer_portion: totals.customerPortion,
        insurance_portion: 0,
        paid_amount: 0,
        balance_due: totals.clientOwes,
        is_insurance: false,
        due_date: input.dueDate || null,
        notes: input.notes || null,
        footer: input.footer || null,
        created_by: userId,
      })
      .select()
      .single();
    if (invErr) throw invErr;

    // 5. Insert parts_lines and deduct stock for catalogue parts
    await this.writeStandaloneLines(tenantId, invoice.id, 'invoice', enriched, userId);

    // 6. AGT hash (non-blocking)
    try {
      const now = new Date();
      const hashResult = await this.agtService.generateDocumentHash(
        tenantId,
        'FT',
        now.toISOString().slice(0, 10),
        now.toISOString().replace(/\.\d{3}Z$/, ''),
        totals.grandTotal,
      );
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
    } catch (err) {
      this.logger.warn(`Hash generation skipped for ${invoice.invoice_number}: ${err instanceof Error ? err.message : 'unknown'}`);
    }

    return invoice;
  }

  /**
   * Hydrates standalone lines with tax rates (from line.taxCodeId or
   * tenant default), pulls unit_cost from parts catalogue when partId
   * is given, and computes subtotal.
   */
  private async enrichLines(
    tenantId: string,
    lines: StandaloneLineInput[],
    defaultTax: { id: string; rate: number } | null,
  ) {
    const client = this.supabase.getClient();
    type Enriched = {
      part_id: string | null;
      description: string;
      quantity: number;
      unit_cost: number;
      sell_price: number;
      subtotal: number;
      tax_code_id: string | null;
      tax_rate: number;
    };
    const out: Enriched[] = [];

    // Resolve tax codes referenced on lines
    const taxIds = Array.from(new Set(lines.map((l) => l.taxCodeId).filter((x): x is string => !!x)));
    const taxMap = new Map<string, number>();
    if (taxIds.length > 0) {
      const { data } = await client
        .from('tax_codes')
        .select('id, rate')
        .in('id', taxIds)
        .eq('tenant_id', tenantId);
      for (const r of (data ?? []) as Array<{ id: string; rate: number }>) {
        taxMap.set(r.id, Number(r.rate));
      }
    }

    // Resolve catalogue parts for unit_cost lookup
    const partIds = Array.from(new Set(lines.map((l) => l.partId).filter((x): x is string => !!x)));
    const partMap = new Map<string, { unit_cost: number }>();
    if (partIds.length > 0) {
      const { data } = await client
        .from('parts')
        .select('id, unit_cost')
        .in('id', partIds)
        .eq('tenant_id', tenantId);
      for (const r of (data ?? []) as Array<{ id: string; unit_cost: number }>) {
        partMap.set(r.id, { unit_cost: Number(r.unit_cost ?? 0) });
      }
    }

    for (const l of lines) {
      const taxCodeId = l.taxCodeId ?? defaultTax?.id ?? null;
      const looked = taxCodeId ? taxMap.get(taxCodeId) : undefined;
      const taxRate: number = looked ?? Number(defaultTax?.rate ?? 0);
      const qty = Number(l.quantity);
      const sell = Number(l.sellPrice);
      const cost: number = l.unitCost != null
        ? Number(l.unitCost)
        : Number((l.partId && partMap.get(l.partId)?.unit_cost) || 0);
      out.push({
        part_id: l.partId ?? null,
        description: l.description,
        quantity: qty,
        unit_cost: cost,
        sell_price: sell,
        subtotal: Math.round(qty * sell * 100) / 100,
        tax_code_id: taxCodeId,
        tax_rate: taxRate,
      });
    }
    return out;
  }

  /**
   * Writes parts_lines pointing at either an invoice_id or a
   * proforma_id (the parent column is chosen by `parent`). For
   * invoice lines that reference a catalogue part, stock is deducted
   * and an inventory_adjustments audit row is written. Proforma lines
   * never touch stock — they're quotes.
   */
  private async writeStandaloneLines(
    tenantId: string,
    parentId: string,
    parent: 'invoice' | 'proforma',
    enriched: Awaited<ReturnType<InvoicesService['enrichLines']>>,
    userId: string,
  ) {
    const client = this.supabase.getClient();
    const rows = enriched.map((l) => ({
      tenant_id: tenantId,
      job_card_id: null,
      invoice_id: parent === 'invoice' ? parentId : null,
      proforma_id: parent === 'proforma' ? parentId : null,
      part_id: l.part_id,
      part_name: l.description,
      part_number: null,
      quantity: l.quantity,
      unit_cost: l.unit_cost,
      markup_pct: 0,
      sell_price: l.sell_price,
      subtotal: l.subtotal,
      tax_code_id: l.tax_code_id,
      tax_rate: l.tax_rate,
      stock_status: parent === 'invoice' ? 'issued' : 'planned',
      issued_at: parent === 'invoice' ? new Date().toISOString() : null,
      line_status: 'charged',
    }));

    const { error } = await client.from('parts_lines').insert(rows);
    if (error) throw error;

    // Stock deduction: only for invoiced sales of catalogue parts
    if (parent === 'invoice') {
      for (const l of enriched) {
        if (!l.part_id) continue;
        const { data: part } = await client
          .from('parts')
          .select('id, stock_qty, part_number')
          .eq('id', l.part_id)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (!part) continue;
        const newStock = Math.max(0, Number(part.stock_qty ?? 0) - l.quantity);
        await client
          .from('parts')
          .update({ stock_qty: newStock, updated_by: userId })
          .eq('id', l.part_id)
          .eq('tenant_id', tenantId);

        await client.from('inventory_adjustments').insert({
          tenant_id: tenantId,
          part_id: l.part_id,
          quantity_change: -l.quantity,
          reason: 'OTC sale (stand-alone invoice)',
          reference: parentId,
          adjusted_by: userId,
        });
      }
    }
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

  // ── Payment links (public /pay/[token]) ────────────────────────

  async createPaymentLink(tenantId: string, invoiceId: string) {
    const client = this.supabase.getClient();

    const { data: invoice, error: fetchErr } = await client
      .from('invoices')
      .select('id, status, balance_due')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();
    if (fetchErr || !invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'draft' || invoice.status === 'cancelled') {
      throw new BadRequestException(
        'Cannot create a payment link for draft or cancelled invoices — send or generate the invoice first.',
      );
    }
    if (Number(invoice.balance_due) <= 0) {
      throw new BadRequestException('Invoice has no balance due.');
    }

    const token = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PAY_LINK_TTL_MS);

    const { data, error } = await client
      .from('invoices')
      .update({
        public_pay_token: token,
        public_pay_created_at: now.toISOString(),
        public_pay_expires_at: expiresAt.toISOString(),
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .select('public_pay_token, public_pay_expires_at, public_pay_created_at')
      .single();

    if (error) throw error;
    return data;
  }

  async revokePaymentLink(tenantId: string, invoiceId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('invoices')
      .update({
        public_pay_token: null,
        public_pay_expires_at: null,
        public_pay_created_at: null,
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return { revoked: true };
  }

  /**
   * Looks up an invoice by its public token. No tenant scoping — the
   * token IS the authorisation. Returns a sanitised payload (no user
   * IDs, no internal notes, no ERP/AGT fields).
   */
  async getPublicByToken(token: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('invoices')
      .select(
        'id, invoice_number, status, grand_total, balance_due, paid_amount, tax_amount, subtotal, invoice_date, due_date, public_pay_expires_at, customer:customers(full_name, phone, email), tenant:tenants(name, phone, email, address, tax_id, logo_url, currency, settings)',
      )
      .eq('public_pay_token', token)
      .limit(1)
      .maybeSingle();

    if (error || !data) throw new NotFoundException('Link not found');

    const expiresAt = data.public_pay_expires_at as string | null;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      throw new NotFoundException('Link has expired');
    }

    // Supabase returns joined relations as either an object or an array
    // depending on the join direction. Normalise to a single record.
    const tenantRaw = Array.isArray(data.tenant)
      ? (data.tenant[0] as Record<string, unknown> | undefined)
      : (data.tenant as Record<string, unknown> | null);
    const settings = (tenantRaw?.settings as Record<string, unknown> | undefined) ?? {};
    const str = (k: string) => {
      const v = settings[k];
      return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
    };
    const payOptions = {
      bankName: str('bank_name'),
      bankAccount: str('bank_account') ?? str('iban'),
      bankReference: str('bank_reference'),
      mpesaPaybill: str('mpesa_paybill') ?? str('mpesa_number'),
      multicaixaNumber: str('multicaixa_number'),
      instructions: str('payment_instructions'),
    };

    const tenantPublic = tenantRaw
      ? {
          name: tenantRaw.name,
          phone: tenantRaw.phone,
          email: tenantRaw.email,
          address: tenantRaw.address,
          tax_id: tenantRaw.tax_id,
          logo_url: tenantRaw.logo_url,
          currency: tenantRaw.currency,
        }
      : null;

    const customerRaw = Array.isArray(data.customer)
      ? (data.customer[0] as Record<string, unknown> | undefined)
      : (data.customer as Record<string, unknown> | null);

    return {
      id: data.id,
      invoice_number: data.invoice_number,
      status: data.status,
      grand_total: data.grand_total,
      balance_due: data.balance_due,
      paid_amount: data.paid_amount,
      tax_amount: data.tax_amount,
      subtotal: data.subtotal,
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      customer: customerRaw ?? null,
      tenant: tenantPublic,
      pay_options: payOptions,
    };
  }
}
