import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import type {
  CreatePartInput,
  UpdatePartInput,
  AdjustStockInput,
  PaginationInput,
  PartCompatibilityRow,
  PartsVehicleFilter,
} from '@mecanix/validators';

interface PartFilters {
  category?: string;
  lowStock?: boolean;
  consumable?: boolean;
  vehicle?: PartsVehicleFilter;
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
      .select(
        '*, vendor:vendors(id, name), tax_code:tax_codes(id, code, rate), compatibility:part_vehicle_compat(make, model, year_from, year_to)',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (search) {
      // Tokenised AND-of-OR search. The input is split on whitespace
      // and every token must appear somewhere across (description,
      // part_number, compat.make, compat.model) — order-independent
      // and gap-tolerant. So "farol raize" matches a part described
      // as "Farol Toyota Raize" even though "Toyota" sits between them.
      //
      // Implementation note: PostgREST can't OR across joined tables,
      // so for each token we resolve the matching compat part_ids
      // separately, then build an OR-clause per token and call .or()
      // multiple times — successive .or() calls are AND'd together
      // by Supabase JS, which is exactly the semantics we want.
      const tokens = search
        .trim()
        .split(/\s+/)
        // Strip commas and parens — PostgREST treats them as structure
        // in or() values and they'd corrupt the filter string.
        .map((t) => t.replace(/[(),]/g, '').trim())
        .filter((t) => t.length > 0)
        .slice(0, 6); // cap blast radius

      for (const token of tokens) {
        const compatHits = await client
          .from('part_vehicle_compat')
          .select('part_id')
          .eq('tenant_id', tenantId)
          .or(`make.ilike.%${token}%,model.ilike.%${token}%`);
        const compatIds = Array.from(
          new Set(
            (compatHits.data ?? [])
              .map((r) => (r as { part_id: string }).part_id)
              .filter(Boolean),
          ),
        );
        const orParts = [
          `description.ilike.%${token}%`,
          `part_number.ilike.%${token}%`,
        ];
        if (compatIds.length > 0) {
          orParts.push(`id.in.(${compatIds.join(',')})`);
        }
        query = query.or(orParts.join(','));
      }
    }

    if (filters.category) {
      query = query.eq('category', filters.category);
    }

    if (filters.lowStock) {
      query = query.filter('stock_qty', 'lte', 'reorder_point');
    }

    if (filters.consumable) {
      query = query.eq('is_consumable', true);
    }

    // Vehicle scope: show parts that are universal OR have a compat row
    // matching the (make, model?, year?) tuple. We resolve the matching
    // part_ids in a separate query because PostgREST can't express an
    // EXISTS subquery directly.
    if (filters.vehicle?.make) {
      const matchingIds = await this.findCompatPartIds(tenantId, filters.vehicle);
      if (matchingIds.length === 0) {
        query = query.eq('is_universal', true);
      } else {
        query = query.or(`is_universal.eq.true,id.in.(${matchingIds.join(',')})`);
      }
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

  private async findCompatPartIds(tenantId: string, vehicle: PartsVehicleFilter): Promise<string[]> {
    if (!vehicle.make) return [];
    const client = this.supabase.getClient();

    let q = client
      .from('part_vehicle_compat')
      .select('part_id, model, year_from, year_to')
      .eq('tenant_id', tenantId)
      .eq('make', vehicle.make);

    const { data, error } = await q;
    if (error) throw error;

    // Filter in JS to honour the (model IS NULL OR model = $model) and
    // (year between year_from..year_to) semantics without a complex .or()
    // string.
    const ids = new Set<string>();
    for (const row of data ?? []) {
      const r = row as { part_id: string; model: string | null; year_from: number | null; year_to: number | null };
      if (r.model && vehicle.model && r.model !== vehicle.model) continue;
      if (vehicle.year != null) {
        if (r.year_from != null && r.year_from > vehicle.year) continue;
        if (r.year_to != null && r.year_to < vehicle.year) continue;
      }
      ids.add(r.part_id);
    }
    return Array.from(ids);
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('parts')
      .select(
        '*, vendor:vendors(id, name), tax_code:tax_codes(id, code, rate), compatibility:part_vehicle_compat(id, make, model, year_from, year_to)',
      )
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
    const client = this.supabase.getClient();
    const { data, error } = await client
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
        is_universal: input.isUniversal ?? false,
        is_consumable: input.isConsumable ?? false,
        uom: input.uom ?? 'each',
        pack_size: input.packSize ?? 1,
        is_active: true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    if (!input.isUniversal && input.compatibility && input.compatibility.length > 0) {
      await this.replaceCompatibility(tenantId, data.id, input.compatibility);
    }

    return data;
  }

  private async replaceCompatibility(
    tenantId: string,
    partId: string,
    rows: PartCompatibilityRow[],
  ) {
    const client = this.supabase.getClient();

    const { error: delError } = await client
      .from('part_vehicle_compat')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('part_id', partId);
    if (delError) throw delError;

    if (rows.length === 0) return;

    const toInsert = rows.map((r) => ({
      tenant_id: tenantId,
      part_id: partId,
      make: r.make.trim(),
      model: r.model && r.model.trim().length > 0 ? r.model.trim() : null,
      year_from: r.yearFrom ?? null,
      year_to: r.yearTo ?? null,
    }));

    const { error: insError } = await client.from('part_vehicle_compat').insert(toInsert);
    if (insError) throw insError;
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
      isUniversal: 'is_universal',
      isConsumable: 'is_consumable',
      uom: 'uom',
      packSize: 'pack_size',
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

    // If the caller explicitly sent compatibility, replace the set.
    // If the part is being switched to universal, clear any old rows.
    if (input.compatibility !== undefined) {
      await this.replaceCompatibility(tenantId, id, input.compatibility);
    } else if (input.isUniversal === true) {
      await this.replaceCompatibility(tenantId, id, []);
    }

    return data;
  }

  /**
   * Distinct vehicle makes for this tenant — used to populate the make
   * dropdown on the part-compatibility editor and the PO parts filter.
   */
  async listVehicleMakes(tenantId: string): Promise<string[]> {
    const client = this.supabase.getClient();

    // Primary source: master vehicle_makes table (global, pre-seeded)
    const fromMaster = await client
      .from('vehicle_makes')
      .select('name')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (fromMaster.error) throw fromMaster.error;

    // Also include any tenant-specific makes not yet in the master table
    const fromVehicles = await client
      .from('vehicles')
      .select('make')
      .eq('tenant_id', tenantId)
      .not('make', 'is', null);
    if (fromVehicles.error) throw fromVehicles.error;

    const fromCompat = await client
      .from('part_vehicle_compat')
      .select('make')
      .eq('tenant_id', tenantId);
    if (fromCompat.error) throw fromCompat.error;

    const set = new Set<string>();
    for (const r of fromMaster.data ?? []) {
      const m = (r as { name: string }).name;
      if (m && m.trim()) set.add(m.trim());
    }
    for (const r of fromVehicles.data ?? []) {
      const m = (r as { make: string | null }).make;
      if (m && m.trim()) set.add(m.trim());
    }
    for (const r of fromCompat.data ?? []) {
      const m = (r as { make: string | null }).make;
      if (m && m.trim()) set.add(m.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Distinct vehicle models for a given make (within this tenant).
   */
  async listVehicleModels(tenantId: string, make: string): Promise<string[]> {
    const client = this.supabase.getClient();

    // Primary source: master vehicle_models table via make name lookup
    const { data: masterMake } = await client
      .from('vehicle_makes')
      .select('id')
      .eq('name', make)
      .maybeSingle();

    let masterModels: { name: string }[] = [];
    if (masterMake) {
      const fromMaster = await client
        .from('vehicle_models')
        .select('name')
        .eq('make_id', masterMake.id)
        .eq('is_active', true)
        .order('name');
      if (fromMaster.error) throw fromMaster.error;
      masterModels = (fromMaster.data ?? []) as { name: string }[];
    }

    // Also include any tenant-specific models not yet in the master table
    const fromVehicles = await client
      .from('vehicles')
      .select('model')
      .eq('tenant_id', tenantId)
      .eq('make', make)
      .not('model', 'is', null);
    if (fromVehicles.error) throw fromVehicles.error;

    const fromCompat = await client
      .from('part_vehicle_compat')
      .select('model')
      .eq('tenant_id', tenantId)
      .eq('make', make)
      .not('model', 'is', null);
    if (fromCompat.error) throw fromCompat.error;

    const set = new Set<string>();
    for (const r of masterModels) {
      if (r.name && r.name.trim()) set.add(r.name.trim());
    }
    for (const r of fromVehicles.data ?? []) {
      const m = (r as { model: string | null }).model;
      if (m && m.trim()) set.add(m.trim());
    }
    for (const r of fromCompat.data ?? []) {
      const m = (r as { model: string | null }).model;
      if (m && m.trim()) set.add(m.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Resolve a vehicle by plate or by job-card number/id into {make, model, year}
   * so the PO parts filter can derive a scope from either input.
   */
  async resolveVehicle(
    tenantId: string,
    args: { plate?: string; jobCardId?: string; jobNumber?: string },
  ): Promise<{ make: string | null; model: string | null; year: number | null; source: string } | null> {
    const client = this.supabase.getClient();

    if (args.plate) {
      const { data } = await client
        .from('vehicles')
        .select('make, model, year, plate')
        .eq('tenant_id', tenantId)
        .ilike('plate', args.plate.trim())
        .limit(1)
        .maybeSingle();
      if (data) {
        return {
          make: (data.make as string | null) ?? null,
          model: (data.model as string | null) ?? null,
          year: (data.year as number | null) ?? null,
          source: `plate:${data.plate}`,
        };
      }
      return null;
    }

    if (args.jobCardId || args.jobNumber) {
      let q = client
        .from('job_cards')
        .select('id, job_number, vehicle:vehicles(make, model, year, plate)')
        .eq('tenant_id', tenantId);
      if (args.jobCardId) q = q.eq('id', args.jobCardId);
      if (args.jobNumber) q = q.eq('job_number', args.jobNumber.trim());
      const { data } = await q.limit(1).maybeSingle();
      if (data && data.vehicle) {
        // Supabase returns the embedded relation as an array even on FK
        // joins; take the first row.
        const rel = data.vehicle as unknown as
          | { make: string | null; model: string | null; year: number | null; plate: string | null }
          | Array<{ make: string | null; model: string | null; year: number | null; plate: string | null }>;
        const v = Array.isArray(rel) ? rel[0] : rel;
        if (v) {
          return {
            make: v.make,
            model: v.model,
            year: v.year,
            source: `jobCard:${data.job_number ?? data.id}`,
          };
        }
      }
      return null;
    }

    return null;
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
   * Flat list of every active part for this tenant, with compatibility,
   * for the catalogue Excel export. No pagination — capped at 10k to
   * avoid runaway responses.
   */
  async exportCatalogue(tenantId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('parts')
      .select(
        'id, part_number, description, category, location, stock_qty, reorder_point, unit_cost, sell_price, is_universal, vendor:vendors(name), tax_code:tax_codes(code, rate), compatibility:part_vehicle_compat(make, model, year_from, year_to)',
      )
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('part_number', { ascending: true })
      .limit(10000);
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Purchase history for a single part: all PO lines that reference it,
   * with vendor + order date. Sorted most-recent first.
   *
   * `lastReceived` is the first entry with received_qty > 0 — that's what
   * the PO line picker uses to prefill the unit cost.
   */
  async getPurchaseHistory(tenantId: string, partId: string) {
    await this.getById(tenantId, partId);

    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('po_lines')
      .select(
        'id, quantity, unit_cost, received_qty, purchase_order:purchase_orders!inner(id, po_number, order_date, expected_date, status, vendor:vendors(id, name))',
      )
      .eq('tenant_id', tenantId)
      .eq('part_id', partId);
    if (error) throw error;

    type Row = {
      id: string;
      quantity: number;
      unit_cost: number;
      received_qty: number;
      purchase_order: {
        id: string;
        po_number: string;
        order_date: string;
        expected_date: string | null;
        status: string;
        vendor: { id: string; name: string } | null | Array<{ id: string; name: string }>;
      } | null;
    };

    const rows = ((data ?? []) as unknown as Row[])
      .filter((r) => r.purchase_order)
      .map((r) => {
        const po = r.purchase_order!;
        const vendorRel = po.vendor;
        const vendor = Array.isArray(vendorRel) ? vendorRel[0] ?? null : vendorRel;
        return {
          po_line_id: r.id,
          po_id: po.id,
          po_number: po.po_number,
          order_date: po.order_date,
          expected_date: po.expected_date,
          status: po.status,
          vendor_id: vendor?.id ?? null,
          vendor_name: vendor?.name ?? null,
          quantity: r.quantity,
          unit_cost: Number(r.unit_cost),
          received_qty: r.received_qty,
        };
      })
      .sort((a, b) => (a.order_date < b.order_date ? 1 : a.order_date > b.order_date ? -1 : 0));

    const lastReceived = rows.find((r) => r.received_qty > 0) ?? null;
    const lastAny = rows[0] ?? null;

    return {
      history: rows,
      lastReceived,
      // Fallback for the PO line picker when nothing has been received yet.
      last: lastReceived ?? lastAny,
    };
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
