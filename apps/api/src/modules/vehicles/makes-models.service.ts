import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MakesModelsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listMakes() {
    const { data, error } = await this.supabase
      .getClient()
      .from('vehicle_makes')
      .select('id, name, country, logo_url')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (error) throw error;
    return data ?? [];
  }

  async listModels(makeId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('vehicle_models')
      .select('id, name, body_type')
      .eq('make_id', makeId)
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data ?? [];
  }

  async listModelsByMakeName(makeName: string) {
    const { data: make } = await this.supabase
      .getClient()
      .from('vehicle_makes')
      .select('id')
      .eq('name', makeName)
      .maybeSingle();

    if (!make) return [];
    return this.listModels(make.id);
  }

  async addMake(name: string, country?: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('vehicle_makes')
      .insert({ name, country: country ?? null })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addModel(makeId: string, name: string, bodyType?: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('vehicle_models')
      .insert({ make_id: makeId, name, body_type: bodyType ?? null })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
