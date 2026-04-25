import { Injectable, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import type { CreateInventoryAdjustmentInput } from '@mecanix/validators';

interface ListFilters {
  warehouseId?: string;
  partId?: string;
  fromDate?: string;
  toDate?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly warehouse: WarehouseService,
  ) {}

  /**
   * Per-part adjustment history. Used on the parts detail page
   * (existing behaviour, unchanged).
   */
  async getAdjustments(tenantId: string, partId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('inventory_adjustments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('part_id', partId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  /**
   * General paginated list of all adjustments across the tenant.
   * Powers the dedicated Stock Adjustments transaction screen.
   * Joins parts + warehouses + users so the table can render names
   * without n+1 fetches.
   */
  async list(tenantId: string, filters: ListFilters, page = 1, pageSize = 50) {
    let query = this.supabase
      .getClient()
      .from('inventory_adjustments')
      .select(
        '*, part:parts(id, part_number, description), warehouse:warehouses(id, name, code), adjuster:users!inventory_adjustments_adjusted_by_fkey(id, full_name)',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (filters.warehouseId) query = query.eq('warehouse_id', filters.warehouseId);
    if (filters.partId) query = query.eq('part_id', filters.partId);
    if (filters.fromDate) query = query.gte('created_at', filters.fromDate);
    if (filters.toDate) query = query.lte('created_at', filters.toDate);

    const { data, error, count } = await query;
    if (error) throw error;

    const rows = (data ?? []).map((row: Record<string, unknown>) => {
      const part = Array.isArray(row.part) ? row.part[0] : row.part;
      const wh = Array.isArray(row.warehouse) ? row.warehouse[0] : row.warehouse;
      const adj = Array.isArray(row.adjuster) ? row.adjuster[0] : row.adjuster;
      return {
        ...row,
        part_number: (part as { part_number?: string } | null)?.part_number ?? null,
        part_description: (part as { description?: string } | null)?.description ?? null,
        warehouse_name: (wh as { name?: string } | null)?.name ?? null,
        warehouse_code: (wh as { code?: string } | null)?.code ?? null,
        adjuster_name: (adj as { full_name?: string } | null)?.full_name ?? null,
      };
    });

    const total = count ?? rows.length;
    return {
      data: rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /**
   * Create a manual stock adjustment. Allows both directions, unlike
   * the legacy parts.adjustStock decreases-only path. Routes the
   * delta through warehouse_stock at the chosen warehouse (or the
   * tenant default if none specified). Records the audit row in
   * inventory_adjustments with warehouse_id.
   *
   * Role-gated to owner/manager via the controller (@Roles).
   */
  async create(
    tenantId: string,
    userId: string,
    input: CreateInventoryAdjustmentInput,
  ) {
    const client = this.supabase.getClient();

    // Validate the part belongs to this tenant.
    const { data: part } = await client
      .from('parts')
      .select('id')
      .eq('id', input.partId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!part) throw new BadRequestException('Part not found in this tenant');

    const warehouseId = input.warehouseId ?? (await this.warehouse.getDefaultWarehouseId(tenantId));

    // applyStockDelta upserts warehouse_stock and refuses negative
    // resulting quantities. parts.stock_qty is auto-synced via the
    // warehouse_stock trigger.
    await this.warehouse.applyStockDelta(tenantId, warehouseId, input.partId, input.quantityChange);

    const { data, error } = await client
      .from('inventory_adjustments')
      .insert({
        tenant_id: tenantId,
        part_id: input.partId,
        warehouse_id: warehouseId,
        quantity_change: input.quantityChange,
        reason: input.reason,
        reference: input.reference || null,
        adjusted_by: userId,
      })
      .select('*, part:parts(id, part_number, description), warehouse:warehouses(id, name, code)')
      .single();

    if (error) throw error;
    return data;
  }
}
