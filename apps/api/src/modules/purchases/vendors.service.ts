import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateVendorInput, UpdateVendorInput } from '@mecanix/validators';

@Injectable()
export class VendorsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, search?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('vendors')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,contact_name.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('vendors')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      throw new NotFoundException('Vendor not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreateVendorInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('vendors')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        contact_name: input.contactName || null,
        phone: input.phone || null,
        email: input.email || null,
        address: input.address || null,
        lead_time_days: input.leadTimeDays ?? null,
        tax_id: input.taxId || null,
        payment_terms: input.paymentTerms || null,
        notes: input.notes || null,
        is_active: true,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateVendorInput) {
    await this.getById(tenantId, id);

    // Block deactivation if vendor has open POs or unpaid bills
    if ((input as Record<string, unknown>).isActive === false) {
      const client = this.supabase.getClient();

      const { data: openPOs } = await client
        .from('purchase_orders')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', id)
        .eq('tenant_id', tenantId)
        .not('status', 'in', '("complete","cancelled")');

      if ((openPOs as unknown as { count: number })?.count > 0 || (openPOs && Array.isArray(openPOs) && openPOs.length > 0)) {
        throw new BadRequestException('Cannot delete vendor with open purchase orders');
      }

      const { data: unpaidBills } = await client
        .from('bills')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', id)
        .eq('tenant_id', tenantId)
        .neq('status', 'paid');

      if ((unpaidBills as unknown as { count: number })?.count > 0 || (unpaidBills && Array.isArray(unpaidBills) && unpaidBills.length > 0)) {
        throw new BadRequestException('Cannot delete vendor with unpaid bills');
      }
    }

    const updateData: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      name: 'name',
      contactName: 'contact_name',
      phone: 'phone',
      email: 'email',
      address: 'address',
      taxId: 'tax_id',
      leadTimeDays: 'lead_time_days',
      paymentTerms: 'payment_terms',
      notes: 'notes',
      isActive: 'is_active',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if ((input as Record<string, unknown>)[camel] !== undefined) {
        updateData[snake] = (input as Record<string, unknown>)[camel] ?? null;
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('vendors')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
