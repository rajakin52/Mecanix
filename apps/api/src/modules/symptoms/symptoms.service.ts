import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateSymptomCodeInput } from '@mecanix/validators';

@Injectable()
export class SymptomsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, family?: string, search?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('symptom_codes')
      .select('*')
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .eq('is_active', true);

    if (family) {
      query = query.eq('family', family);
    }

    if (search) {
      query = query.or(`label_en.ilike.%${search}%,label_pt.ilike.%${search}%`);
    }

    query = query.order('usage_count', { ascending: false }).order('sort_order', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async create(tenantId: string, input: CreateSymptomCodeInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('symptom_codes')
      .insert({
        tenant_id: tenantId,
        code: input.code,
        label_en: input.labelEn,
        label_pt: input.labelPt,
        family: input.family,
        category: input.category,
        icon: input.icon ?? null,
        sort_order: input.sortOrder ?? 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async incrementUsageSimple(tenantId: string, codes: string[]) {
    if (codes.length === 0) return;
    const client = this.supabase.getClient();

    for (const code of codes) {
      // Get current row
      const { data: row } = await client
        .from('symptom_codes')
        .select('id, usage_count')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .eq('code', code)
        .order('tenant_id', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (row) {
        await client
          .from('symptom_codes')
          .update({ usage_count: (row.usage_count as number) + 1 })
          .eq('id', row.id);
      }
    }
  }
}
