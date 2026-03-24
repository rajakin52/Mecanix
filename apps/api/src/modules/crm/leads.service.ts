import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { PaginationInput } from '@mecanix/validators';
import { sanitizeSearch } from '../../common/utils/sanitize';

interface LeadFilters {
  status?: string;
  assignedTo?: string;
}

@Injectable()
export class LeadsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, pagination: PaginationInput, filters: LeadFilters) {
    const client = this.supabase.getClient();
    const { page, pageSize, search } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('crm_leads')
      .select('*, assigned_user:users!crm_leads_assigned_to_fkey(id, full_name)', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (search) {
      const s = sanitizeSearch(search);
      query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
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
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('crm_leads')
      .select('*, assigned_user:users!crm_leads_assigned_to_fkey(id, full_name), customer:customers(id, full_name)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Lead not found');
    }

    // Fetch activities
    const { data: activities } = await client
      .from('crm_activities')
      .select('*, performer:users!crm_activities_performed_by_fkey(id, full_name)')
      .eq('lead_id', id)
      .eq('tenant_id', tenantId)
      .order('performed_at', { ascending: false });

    return {
      ...data,
      activities: activities ?? [],
    };
  }

  async create(tenantId: string, userId: string, input: Record<string, unknown>) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('crm_leads')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        phone: input.phone || null,
        email: input.email || null,
        source: input.source || null,
        service_interest: input.serviceInterest || null,
        vehicle_info: input.vehicleInfo || null,
        estimated_value: input.estimatedValue ?? null,
        notes: input.notes || null,
        assigned_to: input.assignedTo || null,
        next_follow_up: input.nextFollowUp || null,
        customer_id: input.customerId || null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, input: Record<string, unknown>) {
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = {};
    const fieldMap: Record<string, string> = {
      name: 'name',
      phone: 'phone',
      email: 'email',
      source: 'source',
      serviceInterest: 'service_interest',
      vehicleInfo: 'vehicle_info',
      estimatedValue: 'estimated_value',
      notes: 'notes',
      assignedTo: 'assigned_to',
      nextFollowUp: 'next_follow_up',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if (input[camel] !== undefined) {
        updateData[snake] = input[camel] ?? null;
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('crm_leads')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    await this.getById(tenantId, id);

    const { data, error } = await this.supabase
      .getClient()
      .from('crm_leads')
      .update({ status })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async convertToCustomer(tenantId: string, id: string, userId: string) {
    const lead = await this.getById(tenantId, id);

    if (lead.customer_id) {
      return lead;
    }

    const client = this.supabase.getClient();

    // Create customer from lead
    const { data: customer, error: custError } = await client
      .from('customers')
      .insert({
        tenant_id: tenantId,
        full_name: lead.name,
        phone: lead.phone || null,
        email: lead.email || null,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (custError) throw custError;

    // Update lead with customer reference and mark as won
    const { data, error } = await client
      .from('crm_leads')
      .update({ customer_id: customer.id, status: 'won' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getDueFollowUps(tenantId: string) {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .getClient()
      .from('crm_leads')
      .select('*, assigned_user:users!crm_leads_assigned_to_fkey(id, full_name)')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("won","lost")')
      .lte('next_follow_up', today)
      .order('next_follow_up', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
