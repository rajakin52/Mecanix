import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreatePurchaseOrderInput, CreatePoLineInput, ReceiveGoodsInput, PaginationInput } from '@mecanix/validators';

@Injectable()
export class PurchaseOrdersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, pagination: PaginationInput, vendorId?: string) {
    const client = this.supabase.getClient();
    const { page, pageSize } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('purchase_orders')
      .select('*, vendor:vendors(id, name)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (vendorId) {
      query = query.eq('vendor_id', vendorId);
    }

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
      .from('purchase_orders')
      .select('*, vendor:vendors(id, name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Purchase order not found');
    }

    // Fetch PO lines
    const { data: lines } = await client
      .from('po_lines')
      .select('*, part:parts(id, part_number, description)')
      .eq('purchase_order_id', id)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    return {
      ...data,
      lines: lines ?? [],
    };
  }

  async create(tenantId: string, userId: string, input: CreatePurchaseOrderInput) {
    const client = this.supabase.getClient();

    // Generate PO number via RPC
    const { data: poNumber, error: rpcError } = await client.rpc(
      'generate_po_number',
      { p_tenant_id: tenantId },
    );

    if (rpcError) throw rpcError;

    // Calculate total from lines
    const total = input.lines.reduce(
      (sum, line) => sum + line.quantity * line.unitCost,
      0,
    );

    const { data: po, error } = await client
      .from('purchase_orders')
      .insert({
        tenant_id: tenantId,
        po_number: poNumber,
        vendor_id: input.vendorId,
        status: 'draft',
        total_amount: Math.round(total * 100) / 100,
        notes: input.notes || null,
        expected_date: input.expectedDate || null,
        created_by: userId,
        
      })
      .select()
      .single();

    if (error) throw error;

    // Insert PO lines
    const lineInserts = input.lines.map((line) => ({
      tenant_id: tenantId,
      purchase_order_id: po.id,
      part_id: line.partId || null,
      description: line.description,
      quantity: line.quantity,
      unit_cost: line.unitCost,
      subtotal: Math.round(line.quantity * line.unitCost * 100) / 100,
      received_qty: 0,
    }));

    const { error: linesError } = await client
      .from('po_lines')
      .insert(lineInserts);

    if (linesError) throw linesError;

    return this.getById(tenantId, po.id);
  }

  async addLine(tenantId: string, poId: string, userId: string, input: CreatePoLineInput) {
    const client = this.supabase.getClient();

    // Verify PO exists
    await this.getById(tenantId, poId);

    const lineTotal = Math.round(input.quantity * input.unitCost * 100) / 100;

    const { data, error } = await client
      .from('po_lines')
      .insert({
        tenant_id: tenantId,
        purchase_order_id: poId,
        part_id: input.partId,
        description: input.description,
        quantity: input.quantity,
        unit_cost: input.unitCost,
        line_total: lineTotal,
        received_qty: 0,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Recalculate PO total
    await this.recalculateTotal(tenantId, poId);

    return data;
  }

  async removeLine(tenantId: string, lineId: string, poId: string) {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('po_lines')
      .delete()
      .eq('id', lineId)
      .eq('purchase_order_id', poId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    await this.recalculateTotal(tenantId, poId);

    return { deleted: true };
  }

  async receiveGoods(
    tenantId: string,
    poId: string,
    userId: string,
    input: ReceiveGoodsInput,
  ) {
    const client = this.supabase.getClient();

    // Get the PO line
    const { data: line, error: lineError } = await client
      .from('po_lines')
      .select('*')
      .eq('id', input.lineId)
      .eq('purchase_order_id', poId)
      .eq('tenant_id', tenantId)
      .single();

    if (lineError || !line) {
      throw new NotFoundException('PO line not found');
    }

    const newReceivedQty = (line.received_qty as number) + input.receivedQty;
    if (newReceivedQty > (line.quantity as number)) {
      throw new BadRequestException('Received quantity exceeds ordered quantity');
    }

    // Update PO line received qty
    const { error: updateLineError } = await client
      .from('po_lines')
      .update({ received_qty: newReceivedQty })
      .eq('id', input.lineId)
      .eq('tenant_id', tenantId);

    if (updateLineError) throw updateLineError;

    // Update part stock qty
    const { data: part } = await client
      .from('parts')
      .select('stock_qty')
      .eq('id', line.part_id)
      .eq('tenant_id', tenantId)
      .single();

    if (part) {
      const newStockQty = (part.stock_qty as number) + input.receivedQty;
      await client
        .from('parts')
        .update({
          stock_qty: newStockQty,
          
        })
        .eq('id', line.part_id)
        .eq('tenant_id', tenantId);

      // Record inventory adjustment
      await client
        .from('inventory_adjustments')
        .insert({
          tenant_id: tenantId,
          part_id: line.part_id,
          quantity_change: input.receivedQty,
          quantity_before: part.stock_qty,
          quantity_after: newStockQty,
          reason: 'PO goods received',
          reference: poId,
          created_by: userId,
        });
    }

    // Check if all lines are fully received
    const { data: allLines } = await client
      .from('po_lines')
      .select('quantity, received_qty')
      .eq('purchase_order_id', poId)
      .eq('tenant_id', tenantId);

    const allReceived = (allLines ?? []).every(
      (l: { quantity: number; received_qty: number }) => l.received_qty >= l.quantity,
    );
    const someReceived = (allLines ?? []).some(
      (l: { quantity: number; received_qty: number }) => l.received_qty > 0,
    );

    let newStatus: string;
    if (allReceived) {
      newStatus = 'complete';
    } else if (someReceived) {
      newStatus = 'partial';
    } else {
      newStatus = 'sent';
    }

    await client
      .from('purchase_orders')
      .update({ status: newStatus,  })
      .eq('id', poId)
      .eq('tenant_id', tenantId);

    return this.getById(tenantId, poId);
  }

  async updateStatus(tenantId: string, id: string, userId: string, status: string) {
    await this.getById(tenantId, id);

    const validStatuses = ['draft', 'sent', 'partial', 'complete', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`Invalid status: ${status}`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('purchase_orders')
      .update({ status,  })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private async recalculateTotal(tenantId: string, poId: string) {
    const client = this.supabase.getClient();

    const { data: lines } = await client
      .from('po_lines')
      .select('line_total')
      .eq('purchase_order_id', poId)
      .eq('tenant_id', tenantId);

    const total = (lines ?? []).reduce(
      (sum: number, line: { line_total: number }) => sum + (line.line_total || 0),
      0,
    );

    await client
      .from('purchase_orders')
      .update({ total: Math.round(total * 100) / 100 })
      .eq('id', poId)
      .eq('tenant_id', tenantId);
  }
}
