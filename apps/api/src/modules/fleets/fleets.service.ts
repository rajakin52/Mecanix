import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class FleetsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string) {
    const { data, error } = await this.supabase.getClient()
      .from('fleets')
      .select('*, vehicles:vehicles(id, plate, make, model)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('fleets')
      .select('*, customer:customers(id, full_name, phone)')
      .eq('id', id).eq('tenant_id', tenantId).single();
    if (error || !data) throw new NotFoundException('Fleet not found');

    const { data: vehicles } = await client
      .from('vehicles').select('*, last_job:job_cards(id, job_number, status, created_at)')
      .eq('fleet_id', id).eq('tenant_id', tenantId).order('plate');

    const { data: pmSchedules } = await client
      .from('fleet_pm_schedules').select('*, catalog:repair_catalog(name, estimated_hours)')
      .eq('fleet_id', id).eq('tenant_id', tenantId);

    // Spend summary
    const { data: spendData } = await client
      .from('job_cards')
      .select('grand_total, vehicle_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'invoiced')
      .in('vehicle_id', (vehicles ?? []).map(v => v.id));

    const totalSpend = (spendData ?? []).reduce((s, j) => s + Number(j.grand_total || 0), 0);

    return { ...data, vehicles: vehicles ?? [], pm_schedules: pmSchedules ?? [], total_spend: totalSpend };
  }

  async create(tenantId: string, input: Record<string, unknown>) {
    const { data, error } = await this.supabase.getClient()
      .from('fleets')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        company_name: input.companyName ?? null,
        contact_name: input.contactName ?? null,
        contact_phone: input.contactPhone ?? null,
        contact_email: input.contactEmail ?? null,
        customer_id: input.customerId ?? null,
        monthly_budget: input.monthlyBudget ?? null,
        notes: input.notes ?? null,
      })
      .select().single();
    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, input: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.companyName !== undefined) updates.company_name = input.companyName;
    if (input.contactName !== undefined) updates.contact_name = input.contactName;
    if (input.contactPhone !== undefined) updates.contact_phone = input.contactPhone;
    if (input.contactEmail !== undefined) updates.contact_email = input.contactEmail;
    if (input.monthlyBudget !== undefined) updates.monthly_budget = input.monthlyBudget;
    if (input.notes !== undefined) updates.notes = input.notes;

    const { data, error } = await this.supabase.getClient()
      .from('fleets').update(updates).eq('id', id).eq('tenant_id', tenantId).select().single();
    if (error) throw error;
    return data;
  }

  async assignVehicle(tenantId: string, fleetId: string, vehicleId: string) {
    const { error } = await this.supabase.getClient()
      .from('vehicles').update({ fleet_id: fleetId }).eq('id', vehicleId).eq('tenant_id', tenantId);
    if (error) throw error;
    return { assigned: true };
  }

  async removeVehicle(tenantId: string, vehicleId: string) {
    const { error } = await this.supabase.getClient()
      .from('vehicles').update({ fleet_id: null }).eq('id', vehicleId).eq('tenant_id', tenantId);
    if (error) throw error;
    return { removed: true };
  }

  async addPmSchedule(tenantId: string, fleetId: string, input: Record<string, unknown>) {
    const { data, error } = await this.supabase.getClient()
      .from('fleet_pm_schedules').insert({
        tenant_id: tenantId, fleet_id: fleetId,
        name: input.name, catalog_id: input.catalogId ?? null,
        mileage_interval: input.mileageInterval ?? null,
        time_interval_days: input.timeIntervalDays ?? null,
      }).select().single();
    if (error) throw error;
    return data;
  }

  /** Fleet spend report */
  async spendReport(tenantId: string, fleetId: string, startDate?: string, endDate?: string) {
    const client = this.supabase.getClient();
    const { data: vehicles } = await client
      .from('vehicles').select('id, plate, make, model').eq('fleet_id', fleetId).eq('tenant_id', tenantId);

    if (!vehicles || vehicles.length === 0) return { vehicles: [], total: 0 };

    let query = client.from('job_cards')
      .select('id, job_number, vehicle_id, grand_total, labour_total, parts_total, created_at, status')
      .eq('tenant_id', tenantId)
      .in('vehicle_id', vehicles.map(v => v.id))
      .is('deleted_at', null);

    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data: jobs } = await query.order('created_at', { ascending: false });

    const byVehicle = vehicles.map(v => ({
      ...v,
      jobs: (jobs ?? []).filter(j => j.vehicle_id === v.id),
      total_spend: (jobs ?? []).filter(j => j.vehicle_id === v.id).reduce((s, j) => s + Number(j.grand_total || 0), 0),
    }));

    return {
      vehicles: byVehicle,
      total: byVehicle.reduce((s, v) => s + v.total_spend, 0),
    };
  }
}
