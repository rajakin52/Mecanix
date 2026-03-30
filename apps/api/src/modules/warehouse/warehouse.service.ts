import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface CreateWarehouseInput {
  name: string;
  code: string;
  type?: string;
  branchId?: string;
  address?: string;
  isDefault?: boolean;
  notes?: string;
}

interface UpdateWarehouseInput {
  name?: string;
  code?: string;
  type?: string;
  branchId?: string;
  address?: string;
  isDefault?: boolean;
  notes?: string;
}

interface MoveStockInput {
  partId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  reason?: string;
}

@Injectable()
export class WarehouseService {
  constructor(private readonly supabase: SupabaseService) {}

  async listWarehouses(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('warehouses')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async getWarehouse(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('warehouses')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Warehouse not found');
    }

    return data;
  }

  async createWarehouse(tenantId: string, userId: string, input: CreateWarehouseInput) {
    const client = this.supabase.getClient();

    // If this warehouse is set as default, unset others
    if (input.isDefault) {
      await client
        .from('warehouses')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .eq('is_default', true);
    }

    const { data, error } = await client
      .from('warehouses')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        code: input.code,
        type: input.type ?? 'main',
        branch_id: input.branchId || null,
        address: input.address || null,
        is_default: input.isDefault ?? false,
        is_active: true,
        notes: input.notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateWarehouse(tenantId: string, id: string, userId: string, input: UpdateWarehouseInput) {
    await this.getWarehouse(tenantId, id);
    const client = this.supabase.getClient();

    // If setting as default, unset others first
    if (input.isDefault) {
      await client
        .from('warehouses')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .eq('is_default', true);
    }

    const updateData: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      type: 'type',
      branchId: 'branch_id',
      address: 'address',
      isDefault: 'is_default',
      notes: 'notes',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if ((input as Record<string, unknown>)[camel] !== undefined) {
        updateData[snake] = (input as Record<string, unknown>)[camel] ?? null;
      }
    }

    const { data, error } = await client
      .from('warehouses')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteWarehouse(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    // Block deletion if warehouse has stock
    const { data: stock, error: stockErr } = await client
      .from('warehouse_stock')
      .select('id, quantity')
      .eq('warehouse_id', id)
      .eq('tenant_id', tenantId)
      .gt('quantity', 0)
      .limit(1);

    if (stockErr) throw stockErr;

    if (stock && stock.length > 0) {
      throw new BadRequestException('Cannot deactivate warehouse that still has stock. Transfer all stock first.');
    }

    const { data, error } = await client
      .from('warehouses')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getStockByWarehouse(tenantId: string, warehouseId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('warehouse_stock')
      .select('*, part:parts(id, part_number, description, unit_cost, sell_price, category)')
      .eq('tenant_id', tenantId)
      .eq('warehouse_id', warehouseId)
      .order('quantity', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getStockByPart(tenantId: string, partId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('warehouse_stock')
      .select('*, warehouse:warehouses(id, name, code, type)')
      .eq('tenant_id', tenantId)
      .eq('part_id', partId)
      .order('quantity', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getInventorySummary(tenantId: string) {
    const client = this.supabase.getClient();

    // Get all warehouse stock with part cost info
    const { data: stockData, error: stockErr } = await client
      .from('warehouse_stock')
      .select('warehouse_id, quantity, min_quantity, part:parts(unit_cost)')
      .eq('tenant_id', tenantId);

    if (stockErr) throw stockErr;

    // Get warehouses for names
    const { data: warehouses, error: whErr } = await client
      .from('warehouses')
      .select('id, name, code')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (whErr) throw whErr;

    const items = stockData ?? [];
    let totalParts = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const valueByWarehouse: Record<string, { warehouseId: string; name: string; code: string; value: number; partsCount: number }> = {};

    // Initialize warehouse map
    for (const wh of warehouses ?? []) {
      valueByWarehouse[wh.id] = {
        warehouseId: wh.id,
        name: wh.name,
        code: wh.code,
        value: 0,
        partsCount: 0,
      };
    }

    for (const item of items) {
      const qty = item.quantity as number;
      const minQty = item.min_quantity as number;
      const unitCost = (item.part as unknown as Record<string, unknown>)?.unit_cost as number ?? 0;
      const lineValue = qty * unitCost;

      totalParts += qty;
      totalValue += lineValue;

      if (qty === 0) {
        outOfStockCount++;
      } else if (qty <= minQty) {
        lowStockCount++;
      }

      const whId = item.warehouse_id as string;
      if (valueByWarehouse[whId]) {
        valueByWarehouse[whId].value += lineValue;
        valueByWarehouse[whId].partsCount += qty;
      }
    }

    return {
      totalParts,
      totalValue: Math.round(totalValue * 100) / 100,
      lowStockCount,
      outOfStockCount,
      warehouseBreakdown: Object.values(valueByWarehouse).map((wh) => ({
        ...wh,
        value: Math.round(wh.value * 100) / 100,
      })),
    };
  }

  async moveStock(
    tenantId: string,
    userId: string,
    input: MoveStockInput,
  ) {
    const client = this.supabase.getClient();
    const { partId, fromWarehouseId, toWarehouseId, quantity, reason } = input;

    if (fromWarehouseId === toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }

    if (quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    // Check source stock
    const { data: sourceStock, error: srcErr } = await client
      .from('warehouse_stock')
      .select('id, quantity')
      .eq('warehouse_id', fromWarehouseId)
      .eq('part_id', partId)
      .eq('tenant_id', tenantId)
      .single();

    if (srcErr || !sourceStock) {
      throw new NotFoundException('Part not found in source warehouse');
    }

    if ((sourceStock.quantity as number) < quantity) {
      throw new BadRequestException('Insufficient stock in source warehouse');
    }

    // Deduct from source
    const newSourceQty = (sourceStock.quantity as number) - quantity;
    const { error: deductErr } = await client
      .from('warehouse_stock')
      .update({ quantity: newSourceQty })
      .eq('id', sourceStock.id)
      .eq('tenant_id', tenantId);

    if (deductErr) throw deductErr;

    // Add to destination (upsert)
    const { data: destStock } = await client
      .from('warehouse_stock')
      .select('id, quantity')
      .eq('warehouse_id', toWarehouseId)
      .eq('part_id', partId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (destStock) {
      const newDestQty = (destStock.quantity as number) + quantity;
      const { error: addErr } = await client
        .from('warehouse_stock')
        .update({ quantity: newDestQty })
        .eq('id', destStock.id)
        .eq('tenant_id', tenantId);

      if (addErr) throw addErr;
    } else {
      const { error: insertErr } = await client
        .from('warehouse_stock')
        .insert({
          tenant_id: tenantId,
          warehouse_id: toWarehouseId,
          part_id: partId,
          quantity,
          min_quantity: 0,
        });

      if (insertErr) throw insertErr;
    }

    // Record inventory adjustments for both warehouses
    const moveReason = reason || 'Direct stock move';

    const { error: adj1Err } = await client
      .from('inventory_adjustments')
      .insert({
        tenant_id: tenantId,
        part_id: partId,
        warehouse_id: fromWarehouseId,
        quantity_change: -quantity,
        reason: moveReason,
        reference: `Move to warehouse`,
        adjusted_by: userId,
      });

    if (adj1Err) throw adj1Err;

    const { error: adj2Err } = await client
      .from('inventory_adjustments')
      .insert({
        tenant_id: tenantId,
        part_id: partId,
        warehouse_id: toWarehouseId,
        quantity_change: quantity,
        reason: moveReason,
        reference: `Move from warehouse`,
        adjusted_by: userId,
      });

    if (adj2Err) throw adj2Err;

    return { success: true, movedQuantity: quantity };
  }
}
