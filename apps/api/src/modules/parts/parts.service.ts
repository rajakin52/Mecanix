import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import type { CreatePartInput, UpdatePartInput, AdjustStockInput, PaginationInput } from '@mecanix/validators';

interface PartFilters {
  category?: string;
  lowStock?: boolean;
}

@Injectable()
export class PartsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly warehouse: WarehouseService,
  ) {}

  async list(tenantId: string, pagination: PaginationInput, filters: PartFilters = {}) {
    const client = this.supabase.getClient();
    const { page, pageSize, search } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('parts')
      .select('*, vendor:vendors(id, name), tax_code:tax_codes(id, code, rate)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (search) {
      query = query.or(`description.ilike.%${search}%,part_number.ilike.%${search}%`);
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.lowStock) {
      query = query.filter('stock_qty', 'lte', 'reorder_point');
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
    const { data, error } = await this.supabase
      .getClient()
      .from('parts')
      .select('*, vendor:vendors(id, name), tax_code:tax_codes(id, code, rate)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new NotFoundException('Part not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreatePartInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('parts')
      .insert({
        tenant_id: tenantId,
        part_number: input.partNumber,
        description: input.description,
        unit_cost: input.unitCost,
        sell_price: input.sellPrice,
        stock_qty: 0, // Stock can only increase via supplier invoices or initial upload
        reorder_point: input.reorderPoint ?? 0,
        supplier_id: input.supplierId || null,
        category: input.category || null,
        location: input.location || null,
        tax_code_id: input.taxCodeId || null,
        default_warranty_months: input.defaultWarrantyMonths ?? null,
        default_warranty_km: input.defaultWarrantyKm ?? null,
        is_active: true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdatePartInput) {
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = { updated_by: userId };

    const fieldMap: Record<string, string> = {
      partNumber: 'part_number',
      description: 'description',
      unitCost: 'unit_cost',
      sellPrice: 'sell_price',
      stockQty: 'stock_qty',
      reorderPoint: 'reorder_point',
      supplierId: 'supplier_id',
      category: 'category',
      location: 'location',
      taxCodeId: 'tax_code_id',
      defaultWarrantyMonths: 'default_warranty_months',
      defaultWarrantyKm: 'default_warranty_km',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if ((input as Record<string, unknown>)[camel] !== undefined) {
        updateData[snake] = (input as Record<string, unknown>)[camel] ?? null;
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('parts')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Velocity-based reorder suggestions. For each active part with any
   * issuance in the last 90 days, compute:
   *
   *   velocity_per_day   = issued qty / 90
   *   available          = stock_qty - reserved_qty
   *   days_of_cover      = available / velocity_per_day   (Inf if velocity 0)
   *   suggested_qty      = max(0, round(velocity * 14 - available))   // aim for 2 weeks cover
   *   priority           = 'critical' if days_of_cover < 7
   *                        'warning'  if days_of_cover < 14
   *                        'watch'    otherwise
   *
   * Only parts whose suggested_qty > 0 AND velocity > 0 are returned.
   * The shop converts each suggestion into a purchase request with
   * one click from the UI.
   */
  async getReorderSuggestions(tenantId: string) {
    const client = this.supabase.getClient();

    // 1. All issued lines in last 90 days, grouped by part_number.
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: lines } = await client
      .from('parts_lines')
      .select('part_number, quantity')
      .eq('tenant_id', tenantId)
      .eq('stock_status', 'issued')
      .gte('issued_at', since)
      .not('part_number', 'is', null);

    const velocityByPartNumber = new Map<string, number>();
    for (const line of lines ?? []) {
      const key = (line.part_number as string | null) ?? '';
      if (!key) continue;
      velocityByPartNumber.set(
        key,
        (velocityByPartNumber.get(key) ?? 0) + (Number(line.quantity) || 0),
      );
    }

    if (velocityByPartNumber.size === 0) return [];

    // 2. Pull the matching part master rows in one shot.
    const { data: parts } = await client
      .from('parts')
      .select('id, part_number, description, category, stock_qty, reserved_qty, reorder_point, unit_cost, supplier_id, vendor:vendors(id, name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .in('part_number', Array.from(velocityByPartNumber.keys()));

    const suggestions: Array<Record<string, unknown>> = [];
    for (const p of parts ?? []) {
      const partNumber = p.part_number as string;
      const issued90 = velocityByPartNumber.get(partNumber) ?? 0;
      const velocity = issued90 / 90;
      if (velocity <= 0) continue;

      const available = Math.max(
        0,
        (Number(p.stock_qty) || 0) - (Number(p.reserved_qty) || 0),
      );
      const daysOfCover = velocity > 0 ? available / velocity : Number.POSITIVE_INFINITY;
      const targetCoverDays = 14; // aim for two weeks of stock
      const suggestedQty = Math.max(0, Math.ceil(velocity * targetCoverDays - available));
      if (suggestedQty <= 0) continue;

      const priority =
        daysOfCover < 7 ? 'critical' : daysOfCover < 14 ? 'warning' : 'watch';

      suggestions.push({
        part_id: p.id,
        part_number: partNumber,
        description: p.description,
        category: p.category,
        stock_qty: Number(p.stock_qty) || 0,
        reserved_qty: Number(p.reserved_qty) || 0,
        available,
        unit_cost: Number(p.unit_cost) || 0,
        supplier_id: p.supplier_id,
        vendor: p.vendor,
        issued_last_90d: issued90,
        velocity_per_day: Math.round(velocity * 100) / 100,
        days_of_cover:
          daysOfCover === Number.POSITIVE_INFINITY ? null : Math.round(daysOfCover * 10) / 10,
        suggested_qty: suggestedQty,
        estimated_cost: Math.round(suggestedQty * (Number(p.unit_cost) || 0) * 100) / 100,
        priority,
      });
    }

    // Most urgent first.
    const rank = { critical: 0, warning: 1, watch: 2 } as const;
    suggestions.sort((a, b) => {
      const pa = rank[a.priority as keyof typeof rank];
      const pb = rank[b.priority as keyof typeof rank];
      if (pa !== pb) return pa - pb;
      return (Number(a.days_of_cover) || 999) - (Number(b.days_of_cover) || 999);
    });

    return suggestions;
  }

  async getLowStock(tenantId: string) {
    const client = this.supabase.getClient();

    // Fetch all active parts and filter client-side (PostgREST can't compare columns)
    const { data, error } = await client
      .from('parts')
      .select('*, vendor:vendors(id, name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('stock_qty', { ascending: true });

    if (error) throw error;
    return (data ?? []).filter(
      (p: Record<string, unknown>) => (p.stock_qty as number) <= (p.reorder_point as number),
    );
  }

  async adjustStock(
    tenantId: string,
    partId: string,
    userId: string,
    input: AdjustStockInput,
  ) {
    // Decreases-only: manual stock increases must come through supplier
    // invoices, dedicated stock upload, or the new stock-adjustments
    // transaction screen (gated to owner/manager). Decreases like
    // damaged/lost still flow through here.
    if (input.quantityChange > 0) {
      throw new BadRequestException(
        'Manual stock increases are not allowed. Stock can only be increased through supplier invoices.',
      );
    }

    const client = this.supabase.getClient();
    await this.getById(tenantId, partId); // existence + tenant scope check

    const warehouseId = await this.warehouse.getDefaultWarehouseId(tenantId);
    const newQty = await this.warehouse.applyStockDelta(tenantId, warehouseId, partId, input.quantityChange);

    const { error: adjError } = await client
      .from('inventory_adjustments')
      .insert({
        tenant_id: tenantId,
        part_id: partId,
        warehouse_id: warehouseId,
        quantity_change: input.quantityChange,
        reason: input.reason,
        reference: input.reference || null,
        adjusted_by: userId,
      });
    if (adjError) throw adjError;

    // parts.stock_qty is auto-synced by the warehouse_stock_sync_parts
    // trigger; just return the updated part for the response.
    const updated = await this.getById(tenantId, partId);
    return { ...updated, stock_qty: newQty };
  }

  /**
   * Internal method for stock increases — bypasses manual adjustment guard.
   * Called from supplier invoice approval and initial stock upload.
   */
  async increaseStockInternal(
    tenantId: string,
    partId: string,
    userId: string,
    quantityChange: number,
    reason: string,
    reference?: string,
  ) {
    if (quantityChange <= 0) {
      throw new BadRequestException('Internal stock increase must be positive');
    }

    const client = this.supabase.getClient();
    await this.getById(tenantId, partId);

    const warehouseId = await this.warehouse.getDefaultWarehouseId(tenantId);
    await this.warehouse.applyStockDelta(tenantId, warehouseId, partId, quantityChange);

    await client.from('inventory_adjustments').insert({
      tenant_id: tenantId,
      part_id: partId,
      warehouse_id: warehouseId,
      quantity_change: quantityChange,
      reason,
      reference: reference || null,
      adjusted_by: userId,
    });

    return this.getById(tenantId, partId);
  }

  /**
   * Lookup a part by barcode (EAN/UPC) or SKU — used by mobile barcode scanner
   */
  async findByBarcode(tenantId: string, code: string) {
    const client = this.supabase.getClient();

    // Try barcode first
    const { data: byBarcode } = await client
      .from('parts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('barcode', code)
      .limit(1)
      .maybeSingle();

    if (byBarcode) return byBarcode;

    // Try SKU
    const { data: bySku } = await client
      .from('parts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('sku', code)
      .limit(1)
      .maybeSingle();

    if (bySku) return bySku;

    // Try part_number as fallback
    const { data: byPartNumber } = await client
      .from('parts')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('part_number', code)
      .limit(1)
      .maybeSingle();

    return byPartNumber;
  }
}
