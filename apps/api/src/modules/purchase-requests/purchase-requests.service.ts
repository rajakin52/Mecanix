import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface CreatePurchaseRequestInput {
  jobCardId: string;
  partsRequestId?: string;
  items: Array<{
    partId: string;
    quantity: number;
    estimatedUnitCost?: number;
  }>;
  notes?: string;
}

@Injectable()
export class PurchaseRequestsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, status?: string) {
    const client = this.supabase.getClient();
    let query = client
      .from('purchase_requests')
      .select(`
        *,
        job_card:job_cards(id, job_number),
        vendor:vendors(id, name),
        requester:users!purchase_requests_requested_by_fkey(id, full_name),
        items:purchase_request_items(id)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((pr: Record<string, unknown>) => ({
      ...pr,
      items_count: Array.isArray(pr.items) ? pr.items.length : 0,
    }));
  }

  async getById(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('purchase_requests')
      .select(`
        *,
        job_card:job_cards(id, job_number),
        vendor:vendors(id, name),
        requester:users!purchase_requests_requested_by_fkey(id, full_name),
        approver:users!purchase_requests_approved_by_fkey(id, full_name),
        rejector:users!purchase_requests_rejected_by_fkey(id, full_name),
        receiver:users!purchase_requests_received_by_fkey(id, full_name),
        items:purchase_request_items(
          id, part_id, part_name, part_number, quantity,
          estimated_unit_cost, received_quantity, notes
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Purchase request not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreatePurchaseRequestInput) {
    const client = this.supabase.getClient();

    // Generate PR number via RPC
    const { data: prNumber, error: rpcErr } = await client.rpc(
      'generate_purchase_request_number',
      { p_tenant_id: tenantId },
    );
    if (rpcErr) throw rpcErr;

    // Lookup part names/numbers and calculate estimated cost
    let estimatedCost = 0;
    const itemsToInsert: Array<Record<string, unknown>> = [];

    for (const item of input.items) {
      const { data: part, error: partErr } = await client
        .from('parts')
        .select('id, description, part_number, unit_cost')
        .eq('id', item.partId)
        .eq('tenant_id', tenantId)
        .single();

      if (partErr || !part) {
        throw new BadRequestException(`Part ${item.partId} not found`);
      }

      const unitCost = item.estimatedUnitCost ?? (part.unit_cost as number) ?? 0;
      estimatedCost += unitCost * item.quantity;

      itemsToInsert.push({
        tenant_id: tenantId,
        part_id: item.partId,
        part_name: part.description,
        part_number: part.part_number,
        quantity: item.quantity,
        estimated_unit_cost: unitCost,
      });
    }

    // Get auto-approve threshold from tenant settings
    const { data: thresholdSetting } = await client
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'purchase_request_auto_approve_threshold')
      .single();

    const threshold = thresholdSetting
      ? parseFloat(thresholdSetting.value as string)
      : 20000;

    const autoApprove = estimatedCost <= threshold;
    const status = autoApprove ? 'approved' : 'pending_approval';

    // Create purchase request
    const insertData: Record<string, unknown> = {
      tenant_id: tenantId,
      pr_number: prNumber,
      parts_request_id: input.partsRequestId || null,
      job_card_id: input.jobCardId,
      requested_by: userId,
      status,
      estimated_cost: Math.round(estimatedCost * 100) / 100,
      approval_threshold: threshold,
      notes: input.notes || null,
    };

    if (autoApprove) {
      insertData.approved_by = userId;
      insertData.approved_at = new Date().toISOString();
      insertData.approved_via = 'app';
    }

    const { data: pr, error: prErr } = await client
      .from('purchase_requests')
      .insert(insertData)
      .select()
      .single();

    if (prErr) throw prErr;

    // Insert items
    const itemRows = itemsToInsert.map((item) => ({
      ...item,
      purchase_request_id: pr.id,
    }));

    const { error: itemsErr } = await client
      .from('purchase_request_items')
      .insert(itemRows);

    if (itemsErr) throw itemsErr;

    return this.getById(tenantId, pr.id as string);
  }

  async approve(tenantId: string, id: string, userId: string, via: string = 'app') {
    const pr = await this.getById(tenantId, id);

    if (pr.status !== 'pending_approval' && pr.status !== 'draft') {
      throw new BadRequestException(`Cannot approve a purchase request with status: ${pr.status}`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('purchase_requests')
      .update({
        status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        approved_via: via,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async reject(tenantId: string, id: string, userId: string, reason: string) {
    const pr = await this.getById(tenantId, id);

    if (pr.status !== 'pending_approval' && pr.status !== 'draft') {
      throw new BadRequestException(`Cannot reject a purchase request with status: ${pr.status}`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('purchase_requests')
      .update({
        status: 'rejected',
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async linkPurchaseOrder(tenantId: string, id: string, purchaseOrderId: string, vendorId: string) {
    const pr = await this.getById(tenantId, id);

    if (pr.status !== 'approved') {
      throw new BadRequestException('Purchase request must be approved before linking a PO');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('purchase_requests')
      .update({
        status: 'ordered',
        purchase_order_id: purchaseOrderId,
        vendor_id: vendorId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async markReceived(tenantId: string, id: string, userId: string) {
    const pr = await this.getById(tenantId, id);

    if (pr.status !== 'ordered' && pr.status !== 'partial_received' && pr.status !== 'approved') {
      throw new BadRequestException(`Cannot mark as received with status: ${pr.status}`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('purchase_requests')
      .update({
        status: 'received',
        received_at: new Date().toISOString(),
        received_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async cancel(tenantId: string, id: string) {
    const pr = await this.getById(tenantId, id);

    if (pr.status === 'received' || pr.status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel a purchase request with status: ${pr.status}`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('purchase_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
