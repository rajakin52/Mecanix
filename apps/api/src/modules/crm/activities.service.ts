import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ActivitiesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, leadId?: string, customerId?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('crm_activities')
      .select('*, performer:users!crm_activities_performed_by_fkey(id, full_name)')
      .eq('tenant_id', tenantId);

    if (leadId) {
      query = query.eq('lead_id', leadId);
    }
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    query = query.order('performed_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return data ?? [];
  }

  async create(tenantId: string, userId: string, input: Record<string, unknown>) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('crm_activities')
      .insert({
        tenant_id: tenantId,
        lead_id: input.leadId || null,
        customer_id: input.customerId || null,
        activity_type: input.activityType,
        description: input.description,
        outcome: input.outcome || null,
        performed_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // If there's a lead, update the next_follow_up if provided
    if (input.leadId && input.nextFollowUp) {
      await client
        .from('crm_leads')
        .update({ next_follow_up: input.nextFollowUp })
        .eq('id', input.leadId as string)
        .eq('tenant_id', tenantId);
    }

    return data;
  }
}
