import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CustomerTagsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listByCustomer(tenantId: string, customerId: string) {
    const { data } = await this.supabase.getClient()
      .from('customer_tags').select('*').eq('customer_id', customerId).eq('tenant_id', tenantId).order('tag');
    return data ?? [];
  }

  async addTag(tenantId: string, customerId: string, tag: string) {
    const { data, error } = await this.supabase.getClient()
      .from('customer_tags').insert({ tenant_id: tenantId, customer_id: customerId, tag: tag.toLowerCase().trim() })
      .select().single();
    if (error && error.code === '23505') return { exists: true }; // duplicate
    if (error) throw error;
    return data;
  }

  async removeTag(tenantId: string, customerId: string, tag: string) {
    await this.supabase.getClient()
      .from('customer_tags').delete().eq('tenant_id', tenantId).eq('customer_id', customerId).eq('tag', tag);
    return { removed: true };
  }

  async searchByTag(tenantId: string, tag: string) {
    const { data } = await this.supabase.getClient()
      .from('customer_tags').select('customer_id, customer:customers(id, full_name, phone)')
      .eq('tenant_id', tenantId).eq('tag', tag);
    return data ?? [];
  }

  async allTags(tenantId: string) {
    const { data } = await this.supabase.getClient()
      .from('customer_tags').select('tag').eq('tenant_id', tenantId);
    const unique = [...new Set((data ?? []).map(d => d.tag as string))].sort();
    return unique;
  }

  async getLifetimeValue(tenantId: string, customerId: string) {
    const { data } = await this.supabase.getClient()
      .from('customer_lifetime_value').select('*')
      .eq('tenant_id', tenantId).eq('customer_id', customerId).single();
    return data;
  }
}
