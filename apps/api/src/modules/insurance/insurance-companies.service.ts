import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateInsuranceCompanyInput, UpdateInsuranceCompanyInput } from '@mecanix/validators';

@Injectable()
export class InsuranceCompaniesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(search?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('insurance_companies')
      .select('*')
      .eq('is_active', true);

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,code.ilike.%${search}%`,
      );
    }

    query = query.order('name', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;

    return data ?? [];
  }

  async getById(id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('insurance_companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException('Insurance company not found');
    }

    return data;
  }

  async create(input: CreateInsuranceCompanyInput) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('insurance_companies')
      .insert({
        name: input.name,
        code: input.code || null,
        contact_name: input.contactName || null,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        sla_hours: input.slaHours ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  }

  async update(id: string, input: UpdateInsuranceCompanyInput) {
    await this.getById(id);

    const updateData: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      name: 'name',
      code: 'code',
      contactName: 'contact_name',
      phone: 'phone',
      email: 'email',
      address: 'address',
      slaHours: 'sla_hours',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if ((input as Record<string, unknown>)[camel] !== undefined) {
        updateData[snake] = (input as Record<string, unknown>)[camel] ?? null;
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('insurance_companies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return data;
  }
}
