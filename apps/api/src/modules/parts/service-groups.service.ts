import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateServiceGroupInput, UpdateServiceGroupInput } from '@mecanix/validators';

@Injectable()
export class ServiceGroupsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('service_groups')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('service_groups')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new NotFoundException('Service group not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreateServiceGroupInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('service_groups')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        description: input.description || null,
        labour_items: input.labourItems ?? [],
        parts_items: input.partsItems ?? [],
        is_active: true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateServiceGroupInput) {
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = { updated_by: userId };

    if (input.name !== undefined) updateData['name'] = input.name;
    if (input.description !== undefined) updateData['description'] = input.description || null;
    if (input.labourItems !== undefined) updateData['labour_items'] = input.labourItems;
    if (input.partsItems !== undefined) updateData['parts_items'] = input.partsItems;

    const { data, error } = await this.supabase
      .getClient()
      .from('service_groups')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(tenantId: string, id: string, userId: string) {
    await this.getById(tenantId, id);

    const { error } = await this.supabase
      .getClient()
      .from('service_groups')
      .update({
        is_active: false,
        updated_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }
}
