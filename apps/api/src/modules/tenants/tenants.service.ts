import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TenantsService {
  constructor(private readonly supabase: SupabaseService) {}

  async getTenant(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Tenant not found');
    }

    return data;
  }

  async updateTenant(tenantId: string, updates: Record<string, unknown>) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .update(updates)
      .eq('id', tenantId)
      .select()
      .single();

    if (error) {
      throw new NotFoundException('Tenant not found or update failed');
    }

    return data;
  }
}
