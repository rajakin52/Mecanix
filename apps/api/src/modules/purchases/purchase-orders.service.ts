import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { CostingService } from '../parts/costing.service';
import type { CreatePurchaseOrderInput, CreatePoLineInput, ReceiveGoodsInput, PaginationInput } from '@mecanix/validators';

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly warehouse: WarehouseService,
    private readonly costing: CostingService,
  ) {}

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

    // Increment warehouse_stock at the PO line's warehouse if set,
    // else the tenant's default. parts.stock_qty is auto-synced by the
    // warehouse_stock trigger.
    const lineWarehouseId = (line.warehouse_id as string | null) ?? null;
    const warehouseId = lineWarehouseId ?? (await this.warehouse.getDefaultWarehouseId(tenantId));
    await this.warehouse.applyStockDelta(tenantId, warehouseId, line.part_id as string, input.receivedQty);

    await client
      .from('inventory_adjustments')
      .insert({
        tenant_id: tenantId,
        part_id: line.part_id,
        warehouse_id: warehouseId,
        quantity_change: input.receivedQty,
        reason: 'PO goods received',
        reference: poId,
        adjusted_by: userId,
      });

    // Cost-layer ledger: record this receipt so FIFO/LIFO/WAC consumers
    // can draw down accurate cost. Use landed_unit_cost when set (landed
    // costs were distributed before receipt), else the raw PO unit_cost.
    const layerCost = Number(line.landed_unit_cost ?? line.unit_cost ?? 0);
    if (line.part_id && layerCost > 0) {
      try {
        await this.costing.recordReceipt({
          tenantId,
          partId: line.part_id as string,
          warehouseId,
          qty: input.receivedQty,
          unitCost: layerCost,
          sourceType: 'po_receipt',
          sourceReference: input.lineId,
          userId,
        });
      } catch (err) {
        // Non-blocking — the receipt itself succeeded. Layer write failures
        // are logged in CostingService.
        void err;
      }
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

  /**
   * Resolve tenant approval config from tenants.settings jsonb.
   *   po_approval_threshold (numeric, default 0 = always require)
   *   po_approver_roles    (string[], default ['owner','manager'])
   */
  private async getApprovalConfig(tenantId: string): Promise<{ threshold: number; roles: string[] }> {
    const { data } = await this.supabase
      .getClient()
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();
    const settings = (data?.settings ?? {}) as Record<string, unknown>;
    const thresholdRaw = settings.po_approval_threshold;
    const threshold = thresholdRaw == null || thresholdRaw === '' ? 0 : Number(thresholdRaw);
    const rolesRaw = settings.po_approver_roles;
    const roles = Array.isArray(rolesRaw) && rolesRaw.length > 0
      ? (rolesRaw as string[])
      : ['owner', 'manager'];
    return { threshold: Number.isFinite(threshold) ? threshold : 0, roles };
  }

  /**
   * Move a draft PO into the approval pipeline. If the PO total is below
   * the tenant's po_approval_threshold, it auto-approves (bypasses the
   * pending_approval state). Otherwise it lands in pending_approval and
   * awaits an approver.
   *
   * Returns { po, autoApproved, needsApproverNotification } so the
   * controller can fan-out the WhatsApp notification only when needed.
   */
  async submitForApproval(tenantId: string, id: string, userId: string) {
    const po = await this.getById(tenantId, id);
    if (po.status !== 'draft') {
      throw new BadRequestException(`Only drafts can be submitted (current: ${po.status})`);
    }

    const total = Number(po.total_amount ?? 0);
    const cfg = await this.getApprovalConfig(tenantId);
    const autoApproved = cfg.threshold > 0 && total < cfg.threshold;
    const now = new Date().toISOString();

    const update: Record<string, unknown> = {
      submitted_at: now,
      submitted_by: userId,
    };
    if (autoApproved) {
      update.status = 'approved';
      update.approved_at = now;
      update.approved_by = userId;
    } else {
      update.status = 'pending_approval';
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('purchase_orders')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;

    return {
      po: data,
      autoApproved,
      needsApproverNotification: !autoApproved,
      approverRoles: cfg.roles,
    };
  }

  /**
   * Approve a PO. Caller's role must be in the tenant's
   * po_approver_roles list (checked in the controller via the request
   * user's role).
   */
  async approve(tenantId: string, id: string, userId: string) {
    const po = await this.getById(tenantId, id);
    if (po.status !== 'pending_approval') {
      throw new BadRequestException(`PO is ${po.status}, not pending approval`);
    }
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('purchase_orders')
      .update({
        status: 'approved',
        approved_at: now,
        approved_by: userId,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async reject(tenantId: string, id: string, userId: string, reason: string) {
    const po = await this.getById(tenantId, id);
    if (po.status !== 'pending_approval') {
      throw new BadRequestException(`PO is ${po.status}, not pending approval`);
    }
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .getClient()
      .from('purchase_orders')
      .update({
        status: 'rejected',
        rejected_at: now,
        rejected_by: userId,
        rejection_reason: reason.trim(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Reopen a rejected PO for editing — moves back to draft so the
   * creator can fix issues and re-submit.
   */
  async reopen(tenantId: string, id: string, userId: string) {
    const po = await this.getById(tenantId, id);
    if (po.status !== 'rejected') {
      throw new BadRequestException(`Can only reopen rejected POs (current: ${po.status})`);
    }
    const { data, error } = await this.supabase
      .getClient()
      .from('purchase_orders')
      .update({
        status: 'draft',
        submitted_at: null,
        submitted_by: null,
        rejected_at: null,
        rejected_by: null,
        rejection_reason: null,
        approved_at: null,
        approved_by: null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Lookup users with approver role(s) — used by the controller to
   * fan-out WhatsApp notifications.
   */
  async getApproverUsers(tenantId: string): Promise<Array<{ id: string; full_name: string | null; phone: string | null; whatsapp_number: string | null }>> {
    const { roles } = await this.getApprovalConfig(tenantId);
    const { data } = await this.supabase
      .getClient()
      .from('users')
      .select('id, full_name, phone, whatsapp_number')
      .eq('tenant_id', tenantId)
      .in('role', roles)
      .eq('is_active', true);
    return (data ?? []) as Array<{ id: string; full_name: string | null; phone: string | null; whatsapp_number: string | null }>;
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
