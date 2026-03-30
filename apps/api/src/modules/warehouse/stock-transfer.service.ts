import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface CreateTransferInput {
  fromWarehouseId: string;
  toWarehouseId: string;
  notes?: string;
  lines: Array<{
    partId: string;
    quantity: number;
  }>;
}

@Injectable()
export class StockTransferService {
  constructor(private readonly supabase: SupabaseService) {}

  async listTransfers(tenantId: string, status?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('stock_transfers')
      .select('*, from_warehouse:warehouses!stock_transfers_from_warehouse_id_fkey(id, name, code), to_warehouse:warehouses!stock_transfers_to_warehouse_id_fkey(id, name, code)')
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data ?? [];
  }

  async getTransfer(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('stock_transfers')
      .select('*, from_warehouse:warehouses!stock_transfers_from_warehouse_id_fkey(id, name, code), to_warehouse:warehouses!stock_transfers_to_warehouse_id_fkey(id, name, code)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Stock transfer not found');
    }

    // Fetch lines
    const { data: lines, error: linesErr } = await client
      .from('stock_transfer_lines')
      .select('*, part:parts(id, part_number, description)')
      .eq('transfer_id', id)
      .eq('tenant_id', tenantId);

    if (linesErr) throw linesErr;

    return { ...data, lines: lines ?? [] };
  }

  async createTransfer(tenantId: string, userId: string, input: CreateTransferInput) {
    const client = this.supabase.getClient();

    if (input.fromWarehouseId === input.toWarehouseId) {
      throw new BadRequestException('Source and destination warehouses must be different');
    }

    if (!input.lines || input.lines.length === 0) {
      throw new BadRequestException('At least one transfer line is required');
    }

    // Generate transfer number via RPC
    const { data: transferNumber, error: rpcErr } = await client
      .rpc('generate_transfer_number', { p_tenant_id: tenantId });

    if (rpcErr) throw rpcErr;

    // Create transfer header
    const { data: transfer, error: transferErr } = await client
      .from('stock_transfers')
      .insert({
        tenant_id: tenantId,
        transfer_number: transferNumber,
        from_warehouse_id: input.fromWarehouseId,
        to_warehouse_id: input.toWarehouseId,
        status: 'draft',
        notes: input.notes || null,
        created_by: userId,
      })
      .select()
      .single();

    if (transferErr) throw transferErr;

    // Create transfer lines
    const lineInserts = input.lines.map((line) => ({
      tenant_id: tenantId,
      transfer_id: transfer.id,
      part_id: line.partId,
      quantity: line.quantity,
    }));

    const { error: linesErr } = await client
      .from('stock_transfer_lines')
      .insert(lineInserts);

    if (linesErr) throw linesErr;

    return this.getTransfer(tenantId, transfer.id);
  }

  async completeTransfer(tenantId: string, id: string, userId: string) {
    const client = this.supabase.getClient();

    const transfer = await this.getTransfer(tenantId, id);

    if (transfer.status !== 'draft' && transfer.status !== 'in_transit') {
      throw new BadRequestException(`Cannot complete transfer with status "${transfer.status}"`);
    }

    const fromWarehouseId = transfer.from_warehouse_id as string;
    const toWarehouseId = transfer.to_warehouse_id as string;
    const lines = transfer.lines as Array<Record<string, unknown>>;

    // Process each line: deduct from source, add to destination
    for (const line of lines) {
      const partId = line.part_id as string;
      const qty = line.quantity as number;

      // Deduct from source warehouse
      const { data: sourceStock, error: srcErr } = await client
        .from('warehouse_stock')
        .select('id, quantity')
        .eq('warehouse_id', fromWarehouseId)
        .eq('part_id', partId)
        .eq('tenant_id', tenantId)
        .single();

      if (srcErr || !sourceStock) {
        throw new BadRequestException(`Part ${partId} not found in source warehouse`);
      }

      if ((sourceStock.quantity as number) < qty) {
        throw new BadRequestException(`Insufficient stock for part ${partId} in source warehouse`);
      }

      const newSourceQty = (sourceStock.quantity as number) - qty;
      const { error: deductErr } = await client
        .from('warehouse_stock')
        .update({ quantity: newSourceQty })
        .eq('id', sourceStock.id)
        .eq('tenant_id', tenantId);

      if (deductErr) throw deductErr;

      // Add to destination warehouse (upsert)
      const { data: destStock } = await client
        .from('warehouse_stock')
        .select('id, quantity')
        .eq('warehouse_id', toWarehouseId)
        .eq('part_id', partId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (destStock) {
        const newDestQty = (destStock.quantity as number) + qty;
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
            quantity: qty,
            min_quantity: 0,
          });

        if (insertErr) throw insertErr;
      }

      // Record inventory adjustments
      const { error: adj1Err } = await client
        .from('inventory_adjustments')
        .insert({
          tenant_id: tenantId,
          part_id: partId,
          warehouse_id: fromWarehouseId,
          quantity_change: -qty,
          reason: `Stock transfer: ${transfer.transfer_number}`,
          reference: transfer.transfer_number,
          adjusted_by: userId,
        });

      if (adj1Err) throw adj1Err;

      const { error: adj2Err } = await client
        .from('inventory_adjustments')
        .insert({
          tenant_id: tenantId,
          part_id: partId,
          warehouse_id: toWarehouseId,
          quantity_change: qty,
          reason: `Stock transfer: ${transfer.transfer_number}`,
          reference: transfer.transfer_number,
          adjusted_by: userId,
        });

      if (adj2Err) throw adj2Err;

      // Update received_qty on the line
      const { error: lineUpErr } = await client
        .from('stock_transfer_lines')
        .update({ received_qty: qty })
        .eq('id', line.id)
        .eq('tenant_id', tenantId);

      if (lineUpErr) throw lineUpErr;
    }

    // Mark transfer as completed
    const { data, error } = await client
      .from('stock_transfers')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async cancelTransfer(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const transfer = await this.getTransfer(tenantId, id);

    if (transfer.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed transfer');
    }

    if (transfer.status === 'cancelled') {
      throw new BadRequestException('Transfer is already cancelled');
    }

    const { data, error } = await client
      .from('stock_transfers')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
