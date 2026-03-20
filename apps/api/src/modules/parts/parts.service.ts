import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreatePartInput, UpdatePartInput, AdjustStockInput, PaginationInput } from '@mecanix/validators';

interface PartFilters {
  category?: string;
  lowStock?: boolean;
}

@Injectable()
export class PartsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, pagination: PaginationInput, filters: PartFilters = {}) {
    const client = this.supabase.getClient();
    const { page, pageSize, search } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('parts')
      .select('*, vendor:vendors(id, name)', { count: 'exact' })
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
      .select('*, vendor:vendors(id, name)')
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
        stock_qty: input.stockQty ?? 0,
        reorder_point: input.reorderPoint ?? 0,
        supplier_id: input.supplierId || null,
        category: input.category || null,
        location: input.location || null,
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
    const client = this.supabase.getClient();
    const part = await this.getById(tenantId, partId);

    const newQty = (part.stock_qty as number) + input.quantityChange;
    if (newQty < 0) {
      throw new NotFoundException('Insufficient stock for this adjustment');
    }

    // Update stock qty
    const { data, error } = await client
      .from('parts')
      .update({
        stock_qty: newQty,
        updated_by: userId,
      })
      .eq('id', partId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Insert inventory adjustment record
    const { error: adjError } = await client
      .from('inventory_adjustments')
      .insert({
        tenant_id: tenantId,
        part_id: partId,
        quantity_change: input.quantityChange,
        reason: input.reason,
        reference: input.reference || null,
        adjusted_by: userId,
      });

    if (adjError) throw adjError;

    return data;
  }
}
