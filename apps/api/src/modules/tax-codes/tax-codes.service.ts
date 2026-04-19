import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface TaxCode {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  rate: number;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaxCodeInput {
  code: string;
  name: string;
  rate: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export type UpdateTaxCodeInput = Partial<CreateTaxCodeInput>;

@Injectable()
export class TaxCodesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, options: { activeOnly?: boolean } = {}): Promise<TaxCode[]> {
    let query = this.supabase
      .getClient()
      .from('tax_codes')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('rate', { ascending: false });

    if (options.activeOnly) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []) as TaxCode[];
  }

  async getDefault(tenantId: string): Promise<TaxCode | null> {
    const { data } = await this.supabase
      .getClient()
      .from('tax_codes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();
    return (data as TaxCode | null) ?? null;
  }

  async create(tenantId: string, input: CreateTaxCodeInput): Promise<TaxCode> {
    this.validateInput(input);
    const client = this.supabase.getClient();

    // If this is being set as default, clear any previous default.
    if (input.isDefault) {
      await client
        .from('tax_codes')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .eq('is_default', true);
    }

    const { data, error } = await client
      .from('tax_codes')
      .insert({
        tenant_id: tenantId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
        rate: input.rate,
        is_default: input.isDefault ?? false,
        is_active: input.isActive ?? true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(`Tax code "${input.code}" already exists for this tenant.`);
      }
      throw new BadRequestException(error.message);
    }
    return data as TaxCode;
  }

  async update(tenantId: string, id: string, input: UpdateTaxCodeInput): Promise<TaxCode> {
    if (input.rate !== undefined || input.code !== undefined || input.name !== undefined) {
      this.validateInput({
        code: input.code ?? 'TMP',
        name: input.name ?? 'TMP',
        rate: input.rate ?? 0,
      });
    }
    const client = this.supabase.getClient();

    if (input.isDefault) {
      await client
        .from('tax_codes')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
        .eq('is_default', true)
        .neq('id', id);
    }

    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.code !== undefined) payload.code = input.code.trim().toUpperCase();
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.rate !== undefined) payload.rate = input.rate;
    if (input.isDefault !== undefined) payload.is_default = input.isDefault;
    if (input.isActive !== undefined) payload.is_active = input.isActive;

    const { data, error } = await client
      .from('tax_codes')
      .update(payload)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) throw new NotFoundException('Tax code not found');
    return data as TaxCode;
  }

  async remove(tenantId: string, id: string): Promise<{ deleted: true }> {
    const { error } = await this.supabase
      .getClient()
      .from('tax_codes')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      // FK violations: tax code is referenced by items; deactivate instead.
      if (error.code === '23503') {
        throw new BadRequestException(
          'This tax code is in use on existing items. Deactivate it instead of deleting.',
        );
      }
      throw new BadRequestException(error.message);
    }
    return { deleted: true };
  }

  private validateInput(input: CreateTaxCodeInput) {
    if (!input.code || !input.code.trim()) throw new BadRequestException('Code is required');
    if (!input.name || !input.name.trim()) throw new BadRequestException('Name is required');
    if (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 100) {
      throw new BadRequestException('Rate must be between 0 and 100');
    }
  }
}
