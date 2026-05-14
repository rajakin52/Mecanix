import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { InvoicesService } from '../invoices/invoices.service';
import { computeInvoiceTotals } from '../invoices/invoice-math';
import type {
  CreateProformaInput,
  UpdateProformaInput,
  CancelProformaInput,
  PaginationInput,
  StandaloneLineInput,
} from '@mecanix/validators';

interface ProformaFilters {
  status?: string;
  customerId?: string;
}

@Injectable()
export class ProformasService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly invoices: InvoicesService,
  ) {}

  async list(tenantId: string, pagination: PaginationInput, filters: ProformaFilters = {}) {
    const client = this.supabase.getClient();
    const { page, pageSize, search } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('proformas')
      .select('*, customer:customers(id, full_name, phone)', { count: 'exact' })
      .eq('tenant_id', tenantId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.customerId) query = query.eq('customer_id', filters.customerId);
    if (search && search.trim().length > 0) {
      const q = search.trim();
      const { data: custHits } = await client
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .ilike('full_name', `%${q}%`);
      const custIds = (custHits ?? []).map((r) => (r as { id: string }).id);
      const orParts = [`proforma_number.ilike.%${q}%`];
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
    const { data, error } = await client
      .from('proformas')
      .select(
        '*, customer:customers(*), lines:parts_lines(id, part_name, part_number, quantity, unit_cost, sell_price, subtotal, tax_rate, tax_code_id, part_id, discount_pct, discount_amount)',
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Proforma not found');
    return data;
  }

  async create(tenantId: string, userId: string, input: CreateProformaInput) {
    const client = this.supabase.getClient();

    const { data: customer } = await client
      .from('customers')
      .select('id, vat_captive_pct, withholds_service_retention')
      .eq('id', input.customerId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!customer) throw new NotFoundException('Customer not found');

    const { data: proformaNumber, error: rpcErr } = await client.rpc(
      'generate_proforma_number',
      { p_tenant_id: tenantId },
    );
    if (rpcErr) throw rpcErr;

    const enriched = await this.invoices.enrichLines(tenantId, input.lines, null, customer.id);
    const totals = this.totals(enriched, customer, {
      discountPct: input.discountPct,
      discountAmount: input.discountAmount,
    });

    if (totals.grandTotal <= 0) {
      throw new BadRequestException(
        'Proforma grand total is zero. Set a positive sell price on at least one line, or configure a default markup in Pricing settings.',
      );
    }

    const lineDiscountsTotal = enriched.reduce(
      (s, l) => s + (l.gross_subtotal - l.subtotal),
      0,
    );
    const totalDiscount = Math.round((lineDiscountsTotal + totals.invoiceDiscount) * 100) / 100;

    const { data: proforma, error: insErr } = await client
      .from('proformas')
      .insert({
        tenant_id: tenantId,
        proforma_number: proformaNumber,
        customer_id: customer.id,
        status: 'draft',
        valid_until: input.validUntil || null,
        parts_total: totals.partsTotal,
        subtotal: totals.subtotal,
        tax_amount: totals.totalVat,
        vat_by_rate: totals.vatByRate,
        grand_total: totals.grandTotal,
        discount_pct: Number(input.discountPct ?? 0),
        discount_amount: Number(input.discountAmount ?? 0),
        total_discount: totalDiscount,
        notes: input.notes || null,
        footer: input.footer || null,
        created_by: userId,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    await this.invoices.writeStandaloneLines(tenantId, proforma.id, 'proforma', enriched, userId);
    return proforma;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateProformaInput) {
    const proforma = await this.getById(tenantId, id);
    if (proforma.status === 'converted' || proforma.status === 'cancelled') {
      throw new BadRequestException(`Cannot edit a ${proforma.status} proforma`);
    }

    const client = this.supabase.getClient();
    const updateData: Record<string, unknown> = {};
    if (input.customerId !== undefined) updateData['customer_id'] = input.customerId;
    if (input.validUntil !== undefined) updateData['valid_until'] = input.validUntil ?? null;
    if (input.notes !== undefined) updateData['notes'] = input.notes ?? null;
    if (input.footer !== undefined) updateData['footer'] = input.footer ?? null;

    // Invoice-global discount fields apply even without line changes.
    if (input.discountPct !== undefined) updateData['discount_pct'] = Number(input.discountPct);
    if (input.discountAmount !== undefined) updateData['discount_amount'] = Number(input.discountAmount);

    // If lines were provided, recompute totals and replace lines
    if (input.lines !== undefined) {
      const customerId = (input.customerId ?? proforma.customer_id) as string;
      const enriched = await this.invoices.enrichLines(tenantId, input.lines, null, customerId);
      const { data: customer } = await client
        .from('customers')
        .select('vat_captive_pct, withholds_service_retention')
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      // Use the resolved invoice-global discount (either freshly provided
      // or carried over from the existing proforma row).
      const effPct = input.discountPct ?? Number(proforma.discount_pct ?? 0);
      const effAmt = input.discountAmount ?? Number(proforma.discount_amount ?? 0);
      const totals = this.totals(enriched, customer, {
        discountPct: effPct,
        discountAmount: effAmt,
      });
      if (totals.grandTotal <= 0) {
        throw new BadRequestException(
          'Proforma grand total is zero. Set a positive sell price on at least one line.',
        );
      }
      const lineDiscountsTotal = enriched.reduce(
        (s, l) => s + (l.gross_subtotal - l.subtotal),
        0,
      );
      updateData['parts_total'] = totals.partsTotal;
      updateData['subtotal'] = totals.subtotal;
      updateData['tax_amount'] = totals.totalVat;
      updateData['vat_by_rate'] = totals.vatByRate;
      updateData['grand_total'] = totals.grandTotal;
      updateData['total_discount'] =
        Math.round((lineDiscountsTotal + totals.invoiceDiscount) * 100) / 100;

      // Replace lines
      await client.from('parts_lines').delete().eq('tenant_id', tenantId).eq('proforma_id', id);
      await this.invoices.writeStandaloneLines(tenantId, id, 'proforma', enriched, userId);
    }

    const { data, error } = await client
      .from('proformas')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async markSent(tenantId: string, id: string) {
    const proforma = await this.getById(tenantId, id);
    if (proforma.status !== 'draft') {
      throw new BadRequestException(`Proforma is ${proforma.status}, not draft`);
    }
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('proformas')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async cancel(tenantId: string, id: string, input: CancelProformaInput) {
    const proforma = await this.getById(tenantId, id);
    if (proforma.status === 'cancelled' || proforma.status === 'converted') {
      throw new BadRequestException(`Proforma is already ${proforma.status}`);
    }
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('proformas')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: input.reason,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Convert a proforma to a stand-alone invoice. Reuses the line data
   * and produces a real FT (with stock deduction and AGT hash). The
   * proforma is marked status='converted' and linked.
   */
  async convertToInvoice(tenantId: string, userId: string, id: string) {
    const proforma = await this.getById(tenantId, id);
    if (proforma.status === 'converted') {
      throw new BadRequestException('Proforma already converted');
    }
    if (proforma.status === 'cancelled') {
      throw new BadRequestException('Cannot convert a cancelled proforma');
    }

    type LineRow = {
      part_id: string | null;
      part_name: string;
      quantity: number;
      unit_cost: number;
      sell_price: number;
      tax_code_id: string | null;
      discount_pct: number | null;
      discount_amount: number | null;
    };
    const lineRows = (proforma.lines ?? []) as unknown as LineRow[];
    if (lineRows.length === 0) {
      throw new BadRequestException('Proforma has no lines');
    }
    const lines: StandaloneLineInput[] = lineRows.map((l) => ({
      partId: l.part_id ?? undefined,
      description: l.part_name,
      quantity: Number(l.quantity),
      unitCost: Number(l.unit_cost),
      sellPrice: Number(l.sell_price),
      taxCodeId: l.tax_code_id ?? undefined,
      discountPct: Number(l.discount_pct ?? 0),
      discountAmount: Number(l.discount_amount ?? 0),
    }));

    const invoice = await this.invoices.createStandalone(tenantId, userId, {
      customerId: proforma.customer_id as string,
      lines,
      notes: (proforma.notes as string | null) ?? undefined,
      footer: (proforma.footer as string | null) ?? undefined,
      discountPct: Number(proforma.discount_pct ?? 0),
      discountAmount: Number(proforma.discount_amount ?? 0),
    });

    const client = this.supabase.getClient();
    await client
      .from('proformas')
      .update({
        status: 'converted',
        converted_invoice_id: invoice.id,
        converted_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    return invoice;
  }

  private totals(
    enriched: Array<{ subtotal: number; tax_rate: number }>,
    customer: { vat_captive_pct?: number; withholds_service_retention?: boolean } | null,
    discount?: { discountPct?: number; discountAmount?: number },
  ) {
    return computeInvoiceTotals({
      labourLines: [],
      partsLines: enriched.map((l) => ({ subtotal: l.subtotal, tax_rate: l.tax_rate })),
      customerCaptivePct: Number(customer?.vat_captive_pct ?? 0),
      customerRetains: Boolean(customer?.withholds_service_retention),
      isTaxable: true,
      isInsurance: false,
      invoiceDiscountPct: Number(discount?.discountPct ?? 0),
      invoiceDiscountAmount: Number(discount?.discountAmount ?? 0),
    });
  }
}
