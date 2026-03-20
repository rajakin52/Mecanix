import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateCustomerInput, UpdateCustomerInput, PaginationInput } from '@mecanix/validators';

@Injectable()
export class CustomersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, pagination: PaginationInput) {
    const client = this.supabase.getClient();
    const { page, pageSize, search, sortBy, sortOrder } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    if (sortBy) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, count, error } = await query.range(from, to);

    if (error) throw error;

    return {
      data: data ?? [],
      meta: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
    };
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Customer not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreateCustomerInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('customers')
      .insert({
        tenant_id: tenantId,
        full_name: input.fullName,
        phone: input.phone,
        email: input.email || null,
        tax_id: input.taxId || null,
        address: input.address || null,
        notes: input.notes || null,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateCustomerInput) {
    // Verify it exists and belongs to tenant
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = { updated_by: userId };
    if (input.fullName !== undefined) updateData['full_name'] = input.fullName;
    if (input.phone !== undefined) updateData['phone'] = input.phone;
    if (input.email !== undefined) updateData['email'] = input.email || null;
    if (input.taxId !== undefined) updateData['tax_id'] = input.taxId || null;
    if (input.address !== undefined) updateData['address'] = input.address || null;
    if (input.notes !== undefined) updateData['notes'] = input.notes || null;

    const { data, error } = await this.supabase
      .getClient()
      .from('customers')
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
      .from('customers')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  async search(tenantId: string, query: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('customers')
      .select('id, full_name, phone, email')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .or(`full_name.ilike.%${query}%,phone.ilike.%${query}%`)
      .limit(20);

    if (error) throw error;
    return data ?? [];
  }
}
