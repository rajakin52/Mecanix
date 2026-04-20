import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  CreateTireStorageInput,
  UpdateTireStorageInput,
  ChangeTireStorageStatusInput,
} from '@mecanix/validators';

@Injectable()
export class TireStorageService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(
    tenantId: string,
    filters: { status?: string; customerId?: string; vehicleId?: string } = {},
  ) {
    let q = this.supabase
      .getClient()
      .from('tire_storage')
      .select('*, customer:customers(id, full_name, phone), vehicle:vehicles(id, plate, make, model)')
      .eq('tenant_id', tenantId)
      .order('stored_at', { ascending: false });
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.customerId) q = q.eq('customer_id', filters.customerId);
    if (filters.vehicleId) q = q.eq('vehicle_id', filters.vehicleId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tire_storage')
      .select('*, customer:customers(id, full_name, phone), vehicle:vehicles(id, plate, make, model)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Tire storage record not found');

    const { data: events } = await this.supabase
      .getClient()
      .from('tire_storage_events')
      .select('*')
      .eq('storage_id', id)
      .order('created_at', { ascending: false });

    return { ...data, events: events ?? [] };
  }

  async summary(tenantId: string) {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('tire_storage')
      .select('status, monthly_fee, stored_at')
      .eq('tenant_id', tenantId);

    const rows = data ?? [];
    const active = rows.filter((r) => r.status === 'stored');
    const monthlyRevenue = active.reduce((s, r) => s + (Number(r.monthly_fee) || 0), 0);
    return {
      totalActive: active.length,
      fitted: rows.filter((r) => r.status === 'fitted').length,
      returned: rows.filter((r) => r.status === 'returned').length,
      monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
    };
  }

  async create(tenantId: string, userId: string, input: CreateTireStorageInput) {
    const client = this.supabase.getClient();

    const { data: record, error } = await client
      .from('tire_storage')
      .insert({
        tenant_id: tenantId,
        customer_id: input.customerId,
        vehicle_id: input.vehicleId ?? null,
        storage_code: input.storageCode ?? null,
        tire_count: input.tireCount ?? 4,
        tire_brand: input.tireBrand ?? null,
        tire_model: input.tireModel ?? null,
        tire_size: input.tireSize ?? null,
        season: input.season,
        tread_depth_mm: input.treadDepthMm ?? null,
        wheel_included: input.wheelIncluded ?? false,
        photo_urls: input.photoUrls ?? [],
        notes: input.notes ?? null,
        monthly_fee: input.monthlyFee ?? 0,
        currency: input.currency ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();
    if (error) throw error;

    await client.from('tire_storage_events').insert({
      tenant_id: tenantId,
      storage_id: record.id,
      event_type: 'stored',
      notes: input.notes ?? null,
      created_by: userId,
    });

    return record;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateTireStorageInput) {
    await this.getById(tenantId, id);

    const patch: Record<string, unknown> = { updated_by: userId };
    const map: Record<string, string> = {
      storageCode: 'storage_code',
      tireCount: 'tire_count',
      tireBrand: 'tire_brand',
      tireModel: 'tire_model',
      tireSize: 'tire_size',
      season: 'season',
      treadDepthMm: 'tread_depth_mm',
      wheelIncluded: 'wheel_included',
      photoUrls: 'photo_urls',
      notes: 'notes',
      monthlyFee: 'monthly_fee',
      currency: 'currency',
    };
    for (const [camel, snake] of Object.entries(map)) {
      const v = (input as Record<string, unknown>)[camel];
      if (v !== undefined) patch[snake] = v ?? null;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('tire_storage')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async changeStatus(
    tenantId: string,
    id: string,
    userId: string,
    input: ChangeTireStorageStatusInput,
  ) {
    const client = this.supabase.getClient();
    const { data: existing } = await client
      .from('tire_storage')
      .select('status')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (!existing) throw new NotFoundException('Tire storage record not found');

    const patch: Record<string, unknown> = {
      status: input.status,
      updated_by: userId,
    };
    if (input.status !== 'stored') {
      patch.retrieved_at = new Date().toISOString();
    }

    const { data, error } = await client
      .from('tire_storage')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;

    await client.from('tire_storage_events').insert({
      tenant_id: tenantId,
      storage_id: id,
      event_type: input.status,
      notes: input.notes ?? null,
      job_card_id: input.jobCardId ?? null,
      created_by: userId,
    });

    return data;
  }

  async delete(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('tire_storage')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return { deleted: true };
  }
}
