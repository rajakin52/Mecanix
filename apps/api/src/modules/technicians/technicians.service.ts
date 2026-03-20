import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateTechnicianInput, UpdateTechnicianInput } from '@mecanix/validators';

@Injectable()
export class TechniciansService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('technicians')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('technicians')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Technician not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreateTechnicianInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('technicians')
      .insert({
        tenant_id: tenantId,
        full_name: input.fullName,
        phone: input.phone || null,
        specializations: input.specializations ?? [],
        hourly_rate: input.hourlyRate ?? null,
        is_active: input.isActive ?? true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateTechnicianInput) {
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = { updated_by: userId };
    if (input.fullName !== undefined) updateData['full_name'] = input.fullName;
    if (input.phone !== undefined) updateData['phone'] = input.phone || null;
    if (input.specializations !== undefined) updateData['specializations'] = input.specializations;
    if (input.hourlyRate !== undefined) updateData['hourly_rate'] = input.hourlyRate;
    if (input.isActive !== undefined) updateData['is_active'] = input.isActive;

    const { data, error } = await this.supabase
      .getClient()
      .from('technicians')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(tenantId: string, id: string) {
    await this.getById(tenantId, id);

    const { error } = await this.supabase
      .getClient()
      .from('technicians')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }
}
