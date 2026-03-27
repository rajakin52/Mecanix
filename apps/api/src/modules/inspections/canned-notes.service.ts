import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CannedNotesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, category?: string) {
    const client = this.supabase.getClient();
    let query = client
      .from('canned_notes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('category')
      .order('title');

    if (category) query = query.eq('category', category);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async create(tenantId: string, input: { category: string; title: string; content: string }) {
    const { data, error } = await this.supabase
      .getClient()
      .from('canned_notes')
      .insert({
        tenant_id: tenantId,
        category: input.category,
        title: input.title,
        content: input.content,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('canned_notes')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  async seedDefaults(tenantId: string) {
    const defaults = [
      { category: 'brakes', title: 'Brake pads worn', content: 'Brake pads worn to 2mm or less. Replacement recommended immediately for safety.' },
      { category: 'brakes', title: 'Brake discs scored', content: 'Brake discs show scoring/grooves beyond service limit. Replace with pads.' },
      { category: 'brakes', title: 'Brake fluid dark', content: 'Brake fluid is dark/contaminated. Recommend flush and replacement.' },
      { category: 'engine', title: 'Oil leak detected', content: 'Oil leak detected from valve cover gasket. Recommend replacement to prevent further loss.' },
      { category: 'engine', title: 'Belt cracking', content: 'Drive belt showing signs of cracking/wear. Recommend replacement to prevent breakage.' },
      { category: 'engine', title: 'Coolant low', content: 'Coolant level below minimum. Topped up. Check for leaks on next visit.' },
      { category: 'engine', title: 'Air filter dirty', content: 'Air filter heavily contaminated. Restricting airflow. Replacement recommended.' },
      { category: 'suspension', title: 'Shock absorber leaking', content: 'Shock absorber showing oil leak. Reduced damping. Replace in pairs.' },
      { category: 'suspension', title: 'Ball joint worn', content: 'Ball joint has excessive play. Safety concern. Replacement required.' },
      { category: 'tires', title: 'Tread depth low', content: 'Tire tread depth below 3mm. Approaching legal minimum. Replacement recommended.' },
      { category: 'tires', title: 'Uneven tire wear', content: 'Uneven tire wear pattern detected. Indicates alignment issue. Recommend alignment check.' },
      { category: 'electrical', title: 'Battery weak', content: 'Battery voltage below 12.4V under load. May fail soon. Replacement recommended.' },
      { category: 'body', title: 'Wiper streaking', content: 'Wiper blades leaving streaks. Reduced visibility in rain. Replacement recommended.' },
      { category: 'exhaust', title: 'Exhaust leak', content: 'Exhaust leak detected at joint/flange. Noise and emissions concern. Repair needed.' },
      { category: 'hvac', title: 'A/C weak cooling', content: 'A/C system not reaching target temperature. Likely low refrigerant. Regas recommended.' },
    ];

    let created = 0;
    for (const note of defaults) {
      try {
        await this.create(tenantId, note);
        created++;
      } catch { /* skip duplicates */ }
    }
    return { seeded: created };
  }
}
