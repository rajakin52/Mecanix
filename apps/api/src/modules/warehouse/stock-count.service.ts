import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface CreateCountInput {
  warehouseId: string;
  categoryFilter?: string;
  notes?: string;
}

interface UpdateCountLineInput {
  countedQty: number;
  notes?: string;
}

@Injectable()
export class StockCountService {
  constructor(private readonly supabase: SupabaseService) {}

  async listCounts(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('stock_counts')
      .select('*, warehouse:warehouses(id, name, code)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getCount(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('stock_counts')
      .select('*, warehouse:warehouses(id, name, code)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Stock count not found');
    }

    // Fetch lines with part details
    const { data: lines, error: linesErr } = await client
      .from('stock_count_lines')
      .select('*, part:parts(id, part_number, description, unit_cost)')
      .eq('stock_count_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (linesErr) throw linesErr;

    return { ...data, lines: lines ?? [] };
  }

  async createCount(tenantId: string, userId: string, input: CreateCountInput) {
    const client = this.supabase.getClient();

    // Generate count number via RPC
    const { data: countNumber, error: rpcErr } = await client
      .rpc('generate_count_number', { p_tenant_id: tenantId });

    if (rpcErr) throw rpcErr;

    // Create stock count header
    const { data: stockCount, error: countErr } = await client
      .from('stock_counts')
      .insert({
        tenant_id: tenantId,
        count_number: countNumber,
        warehouse_id: input.warehouseId,
        status: 'in_progress',
        category_filter: input.categoryFilter || null,
        notes: input.notes || null,
        counted_by: userId,
        created_by: userId,
      })
      .select()
      .single();

    if (countErr) throw countErr;

    // Get all parts in this warehouse to populate lines
    let stockQuery = client
      .from('warehouse_stock')
      .select('part_id, quantity')
      .eq('warehouse_id', input.warehouseId)
      .eq('tenant_id', tenantId);

    // If category filter, we need to join parts to filter
    const { data: warehouseStock, error: stockErr } = await stockQuery;

    if (stockErr) throw stockErr;

    if (warehouseStock && warehouseStock.length > 0) {
      let partIds = warehouseStock.map((s) => s.part_id as string);

      // If category filter is set, filter parts by category
      if (input.categoryFilter) {
        const { data: filteredParts, error: fpErr } = await client
          .from('parts')
          .select('id')
          .in('id', partIds)
          .eq('category', input.categoryFilter)
          .eq('tenant_id', tenantId);

        if (fpErr) throw fpErr;
        partIds = (filteredParts ?? []).map((p) => p.id as string);
      }

      // Build stock map for quick lookup
      const stockMap = new Map<string, number>();
      for (const s of warehouseStock) {
        stockMap.set(s.part_id as string, s.quantity as number);
      }

      // Create count lines for matching parts
      if (partIds.length > 0) {
        const lineInserts = partIds.map((partId) => ({
          tenant_id: tenantId,
          stock_count_id: stockCount.id,
          part_id: partId,
          system_qty: stockMap.get(partId) ?? 0,
        }));

        const { error: linesErr } = await client
          .from('stock_count_lines')
          .insert(lineInserts);

        if (linesErr) throw linesErr;
      }
    }

    return this.getCount(tenantId, stockCount.id);
  }

  async updateCountLine(
    tenantId: string,
    countId: string,
    lineId: string,
    input: UpdateCountLineInput,
  ) {
    const client = this.supabase.getClient();

    // Verify the count exists and is editable
    const count = await this.getCount(tenantId, countId);
    if (count.status === 'completed' || count.status === 'cancelled') {
      throw new BadRequestException(`Cannot update lines on a ${count.status} stock count`);
    }

    const updateData: Record<string, unknown> = {
      counted_qty: input.countedQty,
    };

    if (input.notes !== undefined) {
      updateData.notes = input.notes || null;
    }

    // Calculate variance_cost: we need the part's unit_cost
    const { data: line, error: lineErr } = await client
      .from('stock_count_lines')
      .select('system_qty, part:parts(unit_cost)')
      .eq('id', lineId)
      .eq('stock_count_id', countId)
      .eq('tenant_id', tenantId)
      .single();

    if (lineErr || !line) {
      throw new NotFoundException('Stock count line not found');
    }

    const systemQty = line.system_qty as number;
    const unitCost = (line.part as unknown as Record<string, unknown>)?.unit_cost as number ?? 0;
    const variance = input.countedQty - systemQty;
    updateData.variance_cost = Math.round(variance * unitCost * 100) / 100;

    const { data, error } = await client
      .from('stock_count_lines')
      .update(updateData)
      .eq('id', lineId)
      .eq('stock_count_id', countId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async approveCount(tenantId: string, countId: string, userId: string) {
    const client = this.supabase.getClient();

    const count = await this.getCount(tenantId, countId);

    if (count.status === 'completed') {
      throw new BadRequestException('Stock count is already completed');
    }

    if (count.status === 'cancelled') {
      throw new BadRequestException('Cannot approve a cancelled stock count');
    }

    const warehouseId = count.warehouse_id as string;
    const countNumber = count.count_number as string;
    const lines = count.lines as Array<Record<string, unknown>>;

    // Process each line with a variance
    for (const line of lines) {
      const countedQty = line.counted_qty as number | null;
      if (countedQty === null) continue; // Skip lines not yet counted

      const systemQty = line.system_qty as number;
      const variance = countedQty - systemQty;

      if (variance === 0) continue; // No adjustment needed

      const partId = line.part_id as string;

      // Adjust warehouse_stock
      const { data: stock, error: stockErr } = await client
        .from('warehouse_stock')
        .select('id, quantity')
        .eq('warehouse_id', warehouseId)
        .eq('part_id', partId)
        .eq('tenant_id', tenantId)
        .single();

      if (stockErr || !stock) {
        throw new BadRequestException(`Stock record not found for part ${partId}`);
      }

      const newQty = (stock.quantity as number) + variance;
      if (newQty < 0) {
        throw new BadRequestException(`Adjustment would result in negative stock for part ${partId}`);
      }

      const { error: updateErr } = await client
        .from('warehouse_stock')
        .update({ quantity: newQty })
        .eq('id', stock.id)
        .eq('tenant_id', tenantId);

      if (updateErr) throw updateErr;

      // Record inventory adjustment
      const { error: adjErr } = await client
        .from('inventory_adjustments')
        .insert({
          tenant_id: tenantId,
          part_id: partId,
          warehouse_id: warehouseId,
          quantity_change: variance,
          reason: `Stock count adjustment: ${countNumber}`,
          reference: countNumber,
          adjusted_by: userId,
        });

      if (adjErr) throw adjErr;
    }

    // Mark count as completed
    const { data, error } = await client
      .from('stock_counts')
      .update({
        status: 'completed',
        approved_by: userId,
        completed_at: new Date().toISOString(),
      })
      .eq('id', countId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async cancelCount(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const count = await this.getCount(tenantId, id);

    if (count.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed stock count');
    }

    if (count.status === 'cancelled') {
      throw new BadRequestException('Stock count is already cancelled');
    }

    const { data, error } = await client
      .from('stock_counts')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
