import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PurchaseRequestsService } from '../purchase-requests/purchase-requests.service';

interface CreatePartsRequestInput {
  jobCardId: string;
  priority?: string;
  oldPartPhoto?: string;
  oldPartNote?: string;
  warehouseId?: string;
  items: Array<{
    partId: string;
    quantity: number;
  }>;
}

@Injectable()
export class PartsRequestsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly purchaseRequestsService: PurchaseRequestsService,
  ) {}

  async list(tenantId: string, status?: string, jobCardId?: string) {
    const client = this.supabase.getClient();
    let query = client
      .from('parts_requests')
      .select(`
        *,
        job_card:job_cards(id, job_number),
        requester:users!parts_requests_requested_by_fkey(id, full_name),
        items:parts_request_items(id)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }
    if (jobCardId) {
      query = query.eq('job_card_id', jobCardId);
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
      .from('parts_requests')
      .select(`
        *,
        job_card:job_cards(id, job_number),
        requester:users!parts_requests_requested_by_fkey(id, full_name),
        handler:users!parts_requests_handled_by_fkey(id, full_name),
        items:parts_request_items(
          id, part_id, part_name, part_number, quantity,
          available, picked, issued, scanned_barcode,
          warehouse_id, bin_location, notes
        )
      `)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Parts request not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreatePartsRequestInput) {
    const client = this.supabase.getClient();

    // Generate request number via RPC
    const { data: requestNumber, error: rpcErr } = await client.rpc(
      'generate_parts_request_number',
      { p_tenant_id: tenantId },
    );
    if (rpcErr) throw rpcErr;

    // Create the parts request
    const { data: pr, error: prErr } = await client
      .from('parts_requests')
      .insert({
        tenant_id: tenantId,
        job_card_id: input.jobCardId,
        request_number: requestNumber,
        requested_by: userId,
        status: 'requested',
        priority: input.priority ?? 'normal',
        old_part_photo: input.oldPartPhoto || null,
        old_part_note: input.oldPartNote || null,
        warehouse_id: input.warehouseId || null,
      })
      .select()
      .single();

    if (prErr) throw prErr;

    // Lookup part details and insert items
    const itemRows: Array<Record<string, unknown>> = [];

    for (const item of input.items) {
      const { data: part, error: partErr } = await client
        .from('parts')
        .select('id, description, part_number')
        .eq('id', item.partId)
        .eq('tenant_id', tenantId)
        .single();

      if (partErr || !part) {
        throw new BadRequestException(`Part ${item.partId} not found`);
      }

      itemRows.push({
        tenant_id: tenantId,
        parts_request_id: pr.id,
        part_id: item.partId,
        part_name: part.description,
        part_number: part.part_number,
        quantity: item.quantity,
      });
    }

    const { error: itemsErr } = await client
      .from('parts_request_items')
      .insert(itemRows);

    if (itemsErr) throw itemsErr;

    return this.getById(tenantId, pr.id as string);
  }

  async startPicking(tenantId: string, id: string, userId: string) {
    const pr = await this.getById(tenantId, id);

    if (pr.status !== 'requested') {
      throw new BadRequestException(`Cannot start picking for status: ${pr.status}`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('parts_requests')
      .update({
        status: 'picking',
        handled_by: userId,
        picked_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async markItemPicked(tenantId: string, requestId: string, itemId: string) {
    await this.getById(tenantId, requestId);

    const { data, error } = await this.supabase
      .getClient()
      .from('parts_request_items')
      .update({ picked: true, available: true })
      .eq('id', itemId)
      .eq('parts_request_id', requestId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Parts request item not found');
    return data;
  }

  async markItemUnavailable(tenantId: string, requestId: string, itemId: string) {
    const pr = await this.getById(tenantId, requestId);
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('parts_request_items')
      .update({ available: false })
      .eq('id', itemId)
      .eq('parts_request_id', requestId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Parts request item not found');

    // Re-fetch items to check availability status
    const { data: items, error: itemsErr } = await client
      .from('parts_request_items')
      .select('*')
      .eq('parts_request_id', requestId)
      .eq('tenant_id', tenantId);

    if (itemsErr) throw itemsErr;

    const allItems = items ?? [];
    const unavailableItems = allItems.filter(
      (i: Record<string, unknown>) => i.available === false,
    );

    // If there are unavailable items, auto-create a purchase request
    if (unavailableItems.length > 0) {
      const prItems = unavailableItems.map((i: Record<string, unknown>) => ({
        partId: i.part_id as string,
        quantity: i.quantity as number,
      }));

      await this.purchaseRequestsService.create(tenantId, pr.requested_by as string, {
        jobCardId: pr.job_card_id as string,
        partsRequestId: requestId,
        items: prItems,
      });
    }

    return data;
  }

  async markReady(tenantId: string, id: string) {
    const pr = await this.getById(tenantId, id);

    if (pr.status !== 'picking') {
      throw new BadRequestException(`Cannot mark ready for status: ${pr.status}`);
    }

    // Check that all available items are picked
    const items = (pr.items as Array<Record<string, unknown>>) ?? [];
    const availableItems = items.filter(
      (i: Record<string, unknown>) => i.available !== false,
    );
    const allPicked = availableItems.every(
      (i: Record<string, unknown>) => i.picked === true,
    );

    if (!allPicked) {
      throw new BadRequestException('Not all available items have been picked');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('parts_requests')
      .update({
        status: 'ready',
        ready_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async issueParts(tenantId: string, id: string, userId: string) {
    const pr = await this.getById(tenantId, id);

    if (pr.status !== 'ready') {
      throw new BadRequestException(`Cannot issue parts for status: ${pr.status}`);
    }

    const client = this.supabase.getClient();
    const items = (pr.items as Array<Record<string, unknown>>) ?? [];
    const issuableItems = items.filter(
      (i: Record<string, unknown>) => i.available !== false && i.picked === true,
    );

    for (const item of issuableItems) {
      const partId = item.part_id as string;
      const qty = item.quantity as number;
      const warehouseId = (item.warehouse_id as string) || (pr.warehouse_id as string);

      // Mark item as issued
      await client
        .from('parts_request_items')
        .update({ issued: true })
        .eq('id', item.id as string)
        .eq('tenant_id', tenantId);

      // Deduct stock from warehouse_stock if warehouse specified
      if (warehouseId) {
        const { data: ws } = await client
          .from('warehouse_stock')
          .select('id, quantity')
          .eq('warehouse_id', warehouseId)
          .eq('part_id', partId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (ws) {
          const newQty = Math.max(0, (ws.quantity as number) - qty);
          await client
            .from('warehouse_stock')
            .update({ quantity: newQty })
            .eq('id', ws.id as string)
            .eq('tenant_id', tenantId);
        }
      } else {
        // Deduct from parts.stock_qty
        const { data: part } = await client
          .from('parts')
          .select('id, stock_qty')
          .eq('id', partId)
          .eq('tenant_id', tenantId)
          .single();

        if (part) {
          const newQty = Math.max(0, (part.stock_qty as number ?? 0) - qty);
          await client
            .from('parts')
            .update({ stock_qty: newQty })
            .eq('id', partId)
            .eq('tenant_id', tenantId);
        }
      }

      // Create inventory adjustment record
      await client.from('inventory_adjustments').insert({
        tenant_id: tenantId,
        part_id: partId,
        warehouse_id: warehouseId || null,
        quantity_change: -qty,
        reason: 'Parts issued to job card',
        reference: `Parts Request ${pr.request_number}`,
        adjusted_by: userId,
      });

      // Lookup part cost/markup for job card line
      const { data: partData } = await client
        .from('parts')
        .select('description, part_number, unit_cost, sell_price, markup_pct')
        .eq('id', partId)
        .eq('tenant_id', tenantId)
        .single();

      if (partData) {
        const unitCost = (partData.unit_cost as number) ?? 0;
        const markupPct = (partData.markup_pct as number) ?? 0;
        const sellPrice = (partData.sell_price as number) ?? unitCost;
        const subtotal = sellPrice * qty;

        await client.from('parts_lines').insert({
          tenant_id: tenantId,
          job_card_id: pr.job_card_id,
          part_id: partId,
          part_name: partData.description,
          part_number: partData.part_number,
          quantity: qty,
          unit_cost: unitCost,
          markup_pct: markupPct,
          sell_price: sellPrice,
          subtotal: Math.round(subtotal * 100) / 100,
          created_by: userId,
          source: 'parts_request',
          source_ref: pr.request_number,
        });
      }
    }

    // Update parts request status
    const { data, error } = await client
      .from('parts_requests')
      .update({
        status: 'issued',
        issued_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async cancel(tenantId: string, id: string, reason?: string) {
    const pr = await this.getById(tenantId, id);

    if (pr.status === 'issued' || pr.status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel a parts request with status: ${pr.status}`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('parts_requests')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: reason || null,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
