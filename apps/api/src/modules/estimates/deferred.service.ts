import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DeferredServicesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, status?: string, vehicleId?: string, customerId?: string) {
    const client = this.supabase.getClient();
    let query = client
      .from('deferred_services')
      .select('*, customer:customers(full_name, phone), vehicle:vehicles(plate, make, model)')
      .eq('tenant_id', tenantId)
      .order('follow_up_date', { ascending: true });

    if (status) query = query.eq('status', status);
    if (vehicleId) query = query.eq('vehicle_id', vehicleId);
    if (customerId) query = query.eq('customer_id', customerId);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getDueForFollowUp(tenantId: string) {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.supabase
      .getClient()
      .from('deferred_services')
      .select('*, customer:customers(full_name, phone), vehicle:vehicles(plate, make, model)')
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'reminded'])
      .lte('follow_up_date', today)
      .order('priority', { ascending: true })
      .order('follow_up_date');

    if (error) throw error;
    return data ?? [];
  }

  async create(tenantId: string, input: {
    customerId: string;
    vehicleId: string;
    description: string;
    estimatedCost?: number;
    priority?: string;
    followUpDate?: string;
    originalEstimateId?: string;
    originalJobCardId?: string;
  }) {
    const { data, error } = await this.supabase
      .getClient()
      .from('deferred_services')
      .insert({
        tenant_id: tenantId,
        customer_id: input.customerId,
        vehicle_id: input.vehicleId,
        description: input.description,
        estimated_cost: input.estimatedCost ?? null,
        priority: input.priority ?? 'yellow',
        follow_up_date: input.followUpDate ?? null,
        original_estimate_id: input.originalEstimateId ?? null,
        original_job_card_id: input.originalJobCardId ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create deferred services from DVI yellow/red items that weren't included in the estimate.
   */
  async createFromDviItems(
    tenantId: string,
    customerId: string,
    vehicleId: string,
    dviItems: Array<Record<string, unknown>>,
    estimateId?: string,
    jobCardId?: string,
  ) {
    const itemsToDefer = dviItems.filter(
      (item) => item.status === 'yellow' || item.status === 'red',
    );

    const created = [];
    for (const item of itemsToDefer) {
      const followUpDate = new Date();
      followUpDate.setDate(
        followUpDate.getDate() + (item.status === 'red' ? 7 : 30),
      );

      const result = await this.create(tenantId, {
        customerId,
        vehicleId,
        description: `${item.name}${item.notes ? ` — ${item.notes}` : ''}`,
        priority: item.status as string,
        followUpDate: followUpDate.toISOString().slice(0, 10),
        originalEstimateId: estimateId,
        originalJobCardId: jobCardId,
      });
      created.push(result);
    }

    return created;
  }

  /**
   * Convert a deferred service to a new job card.
   */
  async convertToJob(tenantId: string, id: string, jobCardId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('deferred_services')
      .update({
        status: 'converted',
        converted_job_id: jobCardId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Mark as reminded (increment counter).
   */
  async markReminded(tenantId: string, id: string) {
    const { data: current } = await this.supabase
      .getClient()
      .from('deferred_services')
      .select('reminder_count')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (!current) throw new NotFoundException('Deferred service not found');

    const count = (current.reminder_count as number) + 1;
    const newStatus = count >= 3 ? 'expired' : 'reminded';

    // Set next follow-up 2 weeks out
    const nextFollowUp = new Date();
    nextFollowUp.setDate(nextFollowUp.getDate() + 14);

    const { data, error } = await this.supabase
      .getClient()
      .from('deferred_services')
      .update({
        status: newStatus,
        reminder_count: count,
        follow_up_date: newStatus === 'expired' ? null : nextFollowUp.toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get summary stats for dashboard.
   */
  async getSummary(tenantId: string) {
    const { data } = await this.supabase
      .getClient()
      .from('deferred_services')
      .select('status, estimated_cost, priority')
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'reminded']);

    const items = data ?? [];
    return {
      totalPending: items.length,
      redCount: items.filter((i) => i.priority === 'red').length,
      yellowCount: items.filter((i) => i.priority === 'yellow').length,
      potentialRevenue: items.reduce((sum, i) => sum + (Number(i.estimated_cost) || 0), 0),
    };
  }
}
