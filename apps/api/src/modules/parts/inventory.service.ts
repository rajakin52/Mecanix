import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class InventoryService {
  constructor(private readonly supabase: SupabaseService) {}

  async getAdjustments(tenantId: string, partId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('inventory_adjustments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('part_id', partId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }
}
