import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { AgtService } from '../agt/agt.service';
import { PricingService } from '../pricing/pricing.service';
import { CostingService } from '../parts/costing.service';
import { WarehouseService } from '../warehouse/warehouse.service';
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
    private readonly pricingService: PricingService,
    private readonly costingService: CostingService,
    private readonly warehouseService: WarehouseService,
  ) {}

  async list(tenantId: string, pagination: PaginationInput, filters: InvoiceFilters = {}) {
    const client = this.supabase.getClient();
    const { page, pageSize, search } = pagination;
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
    if (search && search.trim().length > 0) {
      const q = search.trim();
      // PostgREST OR can't span joined tables, so we resolve matching
      // customer IDs first and union them into the OR clause alongside
      // invoice_number.
      const { data: custHits } = await client
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('full_name', `%${q}%`);
      const custIds = (custHits ?? []).map((r) => (r as { id: string }).id);
      const orParts = [`invoice_number.ilike.%${q}%`];
      if (custIds.length > 0) orParts.push(`customer_id.in.(${custIds.join(',')})`);
      query = query.or(orParts.join(','));
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

    // Enrich the JC join with vehicle (VIN, plate, make/model, mileage)
    // + service writer (advisor) + primary technician so the printed
    // repair invoice can render the full repair-shop fact sheet
    // without separate fetches.
    //
    // PostgREST needs the FK constraint name spelled out for the users
    // join because job_cards has multiple FKs to users (created_by,
    // updated_by, deleted_by, pickup_signed_by, service_writer_id).
    // Without the hint it returns PGRST201 (ambiguous embedding).
    const { data, error } = await client
      .from('invoices')
      .select(
        '*, customer:customers(*), job_card:job_cards(*, vehicle:vehicles(id, plate, vin, make, model, year, color, fuel_type, mileage), service_writer:users!job_cards_service_writer_id_fkey(id, full_name), primary_technician:technicians(id, full_name))',
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)

      .single();

    if (error || !data) {
      throw new NotFoundException('Invoice not found');
    }

    // Active service reminders for the vehicle on the JC — surfaced on the
    // repair-invoice print page as the "Next Service Recommendation" block.
    let nextServiceReminders: Array<Record<string, unknown>> = [];
    const vehicleId =
      ((data.job_card as Record<string, unknown> | null)?.['vehicle_id'] as string | undefined) ?? null;
    if (vehicleId) {
      const { data: reminders } = await client
        .from('service_reminders')
        .select('id, service_name, reminder_type, next_mileage, next_date, notes')
        .eq('tenant_id', tenantId)
        .eq('vehicle_id', vehicleId)
        .eq('status', 'active')
        .order('next_date', { ascending: true, nullsFirst: false })
        .order('next_mileage', { ascending: true, nullsFirst: false });
      nextServiceReminders = (reminders ?? []) as Array<Record<string, unknown>>;
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
      next_service_reminders: nextServiceReminders,
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

    // 2. Get labour lines with their snapshotted tax rate — charged AND
    // not yet billed on another invoice. The billed_on_invoice_id filter
    // is what makes partial invoicing safe: subsequent invoices on the
    // same JC skip lines already billed on a prior invoice.
    const { data: labourLines } = await client
      .from('labour_lines')
      .select('id, subtotal, tax_rate')
      .eq('job_card_id', input.jobCardId)
      .eq('tenant_id', tenantId)
      .eq('line_status', 'charged')
      .is('billed_on_invoice_id', null);

    const labourTotal = (labourLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );

    // 3. Get parts lines with their snapshotted tax rate — charged AND
    // not yet billed.
    const { data: partsLines } = await client
      .from('parts_lines')
      .select('id, subtotal, tax_rate')
      .eq('job_card_id', input.jobCardId)
      .eq('tenant_id', tenantId)
      .eq('line_status', 'charged')
      .is('billed_on_invoice_id', null);

    const partsTotal = (partsLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );

    if ((labourLines ?? []).length === 0 && (partsLines ?? []).length === 0) {
      throw new BadRequestException(
        'Nothing to invoice — every charged line on this job card has already been billed on a prior invoice. Add new labour or parts before issuing another invoice.',
      );
    }

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
      invoiceDiscountPct: Number(input.discountPct ?? 0),
      invoiceDiscountAmount: Number(input.discountAmount ?? 0),
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
        discount_pct: Number(input.discountPct ?? 0),
        discount_amount: Number(input.discountAmount ?? 0),
        total_discount: totals.invoiceDiscount,
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 8a. Freeze every line that contributed to this invoice. From here
    // on the line is read-only — only a credit note + replacement line
    // can change billed amounts.
    const labourIds = (labourLines ?? []).map((l) => (l as { id: string }).id);
    const partsIds = (partsLines ?? []).map((l) => (l as { id: string }).id);
    if (labourIds.length > 0) {
      await client
        .from('labour_lines')
        .update({ billed_on_invoice_id: invoice.id })
        .in('id', labourIds)
        .eq('tenant_id', tenantId);
    }
    if (partsIds.length > 0) {
      await client
        .from('parts_lines')
        .update({ billed_on_invoice_id: invoice.id })
        .in('id', partsIds)
        .eq('tenant_id', tenantId);
    }

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

    const enriched = await this.enrichLines(tenantId, input.lines, defaultTax, customer.id);

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
      invoiceDiscountPct: Number(input.discountPct ?? 0),
      invoiceDiscountAmount: Number(input.discountAmount ?? 0),
    });

    // Total discount actually applied (line + invoice-global combined).
    // Useful for the PDF + reports. lineDiscountsTotal = sum of each line's
    // (gross_subtotal - subtotal).
    const lineDiscountsTotal = enriched.reduce(
      (s, l) => s + (l.gross_subtotal - l.subtotal),
      0,
    );
    const totalDiscount = Math.round((lineDiscountsTotal + totals.invoiceDiscount) * 100) / 100;

    // Refuse zero-value invoices — usually means the user picked a part
    // whose catalogue sell_price is 0 and skipped manually entering one.
    if (totals.grandTotal <= 0) {
      throw new BadRequestException(
        'Invoice grand total is zero. Set a positive sell price on at least one line, or configure a default markup in Pricing settings so the system can auto-price catalogue parts.',
      );
    }

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
        discount_pct: Number(input.discountPct ?? 0),
        discount_amount: Number(input.discountAmount ?? 0),
        total_discount: totalDiscount,
        created_by: userId,
      })
      .select()
      .single();
    if (invErr) throw invErr;

    // 5. Resolve the warehouse stock leaves from. Caller's explicit
    // pick wins; otherwise fall back to the tenant's default warehouse.
    const warehouseId =
      input.warehouseId ?? (await this.warehouseService.getDefaultWarehouseId(tenantId));

    // 6. Insert parts_lines and deduct stock for catalogue parts
    await this.writeStandaloneLines(tenantId, invoice.id, 'invoice', enriched, userId, warehouseId);

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
  /**
   * Hydrate stand-alone (OTC / proforma) lines:
   * - snapshots `part_number` from the catalogue so the invoice PDF
   *   shows the item code (used to be hardcoded null on writes — bug)
   * - resolves tax rate from the line's tax code, then the line's part's
   *   tax code, then the tenant default
   * - if the caller didn't enter a sell price (or entered 0) AND we
   *   know the cost, applies the pricing engine: cost × (1 + resolved
   *   markup%), respecting the customer's price group, category rules,
   *   and tenant `minimum_margin_pct`. Catalogue's stored `sell_price`
   *   is honored when present and non-zero.
   *
   * `customerId` drives the markup resolution (price groups). null is
   * fine — falls back to tenant defaults.
   */
  async enrichLines(
    tenantId: string,
    lines: StandaloneLineInput[],
    defaultTax: { id: string; rate: number } | null,
    customerId: string | null,
  ) {
    const client = this.supabase.getClient();
    type Enriched = {
      part_id: string | null;
      part_number: string | null;
      description: string;
      quantity: number;
      unit_cost: number;
      sell_price: number;
      sell_price_source: 'manual' | 'catalogue' | 'auto_markup';
      subtotal: number;
      tax_code_id: string | null;
      tax_rate: number;
    };
    type EnrichedWithDiscount = Enriched & {
      discount_pct: number;
      discount_amount: number;
      gross_subtotal: number; // qty × sell_price (pre-line-discount)
    };
    const out: EnrichedWithDiscount[] = [];

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

    // Resolve catalogue parts for cost / catalogue sell_price / category /
    // part_number lookup.
    const partIds = Array.from(new Set(lines.map((l) => l.partId).filter((x): x is string => !!x)));
    type PartLookup = {
      unit_cost: number;
      sell_price: number;
      category: string | null;
      part_number: string | null;
    };
    const partMap = new Map<string, PartLookup>();
    if (partIds.length > 0) {
      const { data } = await client
        .from('parts')
        .select('id, unit_cost, sell_price, category, part_number')
        .in('id', partIds)
        .eq('tenant_id', tenantId);
      for (const r of (data ?? []) as Array<{
        id: string;
        unit_cost: number | null;
        sell_price: number | null;
        category: string | null;
        part_number: string | null;
      }>) {
        partMap.set(r.id, {
          unit_cost: Number(r.unit_cost ?? 0),
          sell_price: Number(r.sell_price ?? 0),
          category: r.category,
          part_number: r.part_number,
        });
      }
    }

    // Tenant pricing settings — drives the minimum-margin floor.
    const pricing = await this.pricingService.getPricingSettings(tenantId);
    const minMarginPct = Number(pricing.minimumMarginPct ?? 0);

    for (const l of lines) {
      const taxCodeId = l.taxCodeId ?? defaultTax?.id ?? null;
      const looked = taxCodeId ? taxMap.get(taxCodeId) : undefined;
      const taxRate: number = looked ?? Number(defaultTax?.rate ?? 0);
      const qty = Number(l.quantity);
      const part = l.partId ? partMap.get(l.partId) : undefined;

      // Cost: explicit input > catalogue > 0
      const cost: number = l.unitCost != null
        ? Number(l.unitCost)
        : Number(part?.unit_cost ?? 0);

      // Sell price resolution waterfall.
      let sell = Number(l.sellPrice ?? 0);
      let sellSource: 'manual' | 'catalogue' | 'auto_markup' = 'manual';
      if (sell <= 0 && part && part.sell_price > 0) {
        sell = part.sell_price;
        sellSource = 'catalogue';
      }
      if (sell <= 0 && cost > 0) {
        const { markupPct } = await this.pricingService.resolveMarkup(
          tenantId,
          customerId,
          part?.category ?? null,
        );
        sell = Math.round(cost * (1 + markupPct / 100) * 100) / 100;
        sellSource = 'auto_markup';
      }
      // Minimum margin floor — only when we have a positive cost to
      // compare against. Margin = (sell - cost) / sell × 100.
      if (sell > 0 && cost > 0 && minMarginPct > 0) {
        const minSell = Math.round((cost / (1 - minMarginPct / 100)) * 100) / 100;
        if (sell < minSell) sell = minSell;
      }

      // Line-level discount. pct and amount are additive (pct first).
      const grossSubtotal = Math.round(qty * sell * 100) / 100;
      const discPct = Number(l.discountPct ?? 0);
      const discAmt = Number(l.discountAmount ?? 0);
      const rawDiscount = (grossSubtotal * discPct) / 100 + discAmt;
      const lineDiscount = Math.min(rawDiscount, grossSubtotal);
      const subtotal = Math.round((grossSubtotal - lineDiscount) * 100) / 100;

      out.push({
        part_id: l.partId ?? null,
        part_number: part?.part_number ?? null,
        description: l.description,
        quantity: qty,
        unit_cost: cost,
        sell_price: sell,
        sell_price_source: sellSource,
        subtotal,
        tax_code_id: taxCodeId,
        tax_rate: taxRate,
        discount_pct: discPct,
        discount_amount: discAmt,
        gross_subtotal: grossSubtotal,
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
  async writeStandaloneLines(
    tenantId: string,
    parentId: string,
    parent: 'invoice' | 'proforma',
    enriched: Awaited<ReturnType<InvoicesService['enrichLines']>>,
    userId: string,
    warehouseId?: string | null,
  ) {
    const client = this.supabase.getClient();
    const rows = enriched.map((l) => ({
      tenant_id: tenantId,
      job_card_id: null,
      invoice_id: parent === 'invoice' ? parentId : null,
      proforma_id: parent === 'proforma' ? parentId : null,
      part_id: l.part_id,
      part_name: l.description,
      part_number: l.part_number, // snapshot from catalogue
      // Stamp the warehouse on each line so downstream reports
      // (movement, valuation) can attribute the sale correctly.
      warehouse_id: parent === 'invoice' ? warehouseId ?? null : null,
      quantity: l.quantity,
      unit_cost: l.unit_cost,
      markup_pct: 0,
      sell_price: l.sell_price,
      subtotal: l.subtotal,
      tax_code_id: l.tax_code_id,
      tax_rate: l.tax_rate,
      discount_pct: l.discount_pct,
      discount_amount: l.discount_amount,
      // Pricing-decision snapshot (audit trail). cost_method is set later
      // by the consume() call for invoice lines; nullable here so proforma
      // (no consume) is fine.
      sell_price_source: l.sell_price_source,
      margin_pct_at_issue:
        l.sell_price > 0 && l.unit_cost > 0
          ? Math.round(((l.sell_price - l.unit_cost) / l.sell_price) * 100000) / 1000
          : null,
      // Stock semantics:
      //  invoice  → 'issued' (stock actually leaves the shelf)
      //  proforma → null (it's a quote — no stock movement). The CHECK
      //             constraint added in 00037 only allows reserved/issued/
      //             returned, so we must NOT write 'planned' here.
      stock_status: parent === 'invoice' ? 'issued' : null,
      issued_at: parent === 'invoice' ? new Date().toISOString() : null,
      line_status: 'charged',
    }));

    const { error } = await client.from('parts_lines').insert(rows);
    if (error) throw error;

    // Stock deduction: only for invoiced sales of catalogue parts.
    //
    // The single source of truth for stock is warehouse_stock — parts.stock_qty
    // is a read-only cache kept in sync by the trigger from migration 00108.
    // For OTC we pick the first warehouse_stock row for the part and
    // decrement there.
    //
    // Additionally we now consume from the parts_cost_layers ledger per the
    // tenant's chosen cost method (FIFO/LIFO/WAC). The actual cost drawn is
    // snapshotted back onto this parts_line so margin reports stay correct
    // even when costs drift after the sale.
    if (parent === 'invoice') {
      for (const l of enriched) {
        if (!l.part_id) continue;
        const qty = l.quantity;

        // Pick the warehouse_stock row for the chosen warehouse when
        // one was provided; otherwise fall back to the first row
        // (legacy behavior — kept so single-warehouse tenants keep
        // working without explicit picks).
        let whStockQuery = client
          .from('warehouse_stock')
          .select('id, quantity')
          .eq('part_id', l.part_id)
          .eq('tenant_id', tenantId);
        if (warehouseId) whStockQuery = whStockQuery.eq('warehouse_id', warehouseId);
        const { data: whStock } = await whStockQuery.limit(1).maybeSingle();

        if (whStock) {
          await client
            .from('warehouse_stock')
            .update({ quantity: Number(whStock.quantity) - qty })
            .eq('id', whStock.id)
            .eq('tenant_id', tenantId);
        } else {
          this.logger.warn(
            `OTC sale of part ${l.part_id} has no warehouse_stock row — audit logged but no stock movement performed`,
          );
        }

        // Draw layers and snapshot the method-resolved unit cost onto the
        // line. last_cost just returns parts.unit_cost; FIFO/LIFO/WAC
        // consume the layer ledger. Also persist cost_method so the audit
        // trail shows which method was applied at issue.
        try {
          const draw = await this.costingService.consume(tenantId, l.part_id, qty);
          if (draw.unitCost > 0) {
            const newMargin =
              l.sell_price > 0
                ? Math.round(((l.sell_price - draw.unitCost) / l.sell_price) * 100000) / 1000
                : null;
            await client
              .from('parts_lines')
              .update({
                unit_cost: draw.unitCost,
                cost_method: draw.method,
                margin_pct_at_issue: newMargin,
              })
              .eq('invoice_id', parentId)
              .eq('part_id', l.part_id)
              .eq('tenant_id', tenantId);
          }
        } catch (err) {
          this.logger.warn(
            `Cost-layer consume failed for part ${l.part_id} on invoice ${parentId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }

        await client.from('inventory_adjustments').insert({
          tenant_id: tenantId,
          part_id: l.part_id,
          quantity_change: -qty,
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
