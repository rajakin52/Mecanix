import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateUpsellItemInput, UpdateUpsellItemInput } from '@mecanix/validators';

@Injectable()
export class UpsellService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, applicableTo?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('upsell_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (applicableTo) {
      query = query.or(`applicable_to.eq.${applicableTo},applicable_to.eq.both`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('upsell_items')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Upsell item not found');
    return data;
  }

  async create(tenantId: string, userId: string, input: CreateUpsellItemInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('upsell_items')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        description: input.description ?? null,
        price: input.price,
        category: input.category ?? 'service',
        icon: input.icon ?? null,
        is_active: input.isActive ?? true,
        sort_order: input.sortOrder ?? 0,
        applicable_to: input.applicableTo ?? 'both',
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateUpsellItemInput) {
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = { updated_by: userId };
    const fieldMap: Record<string, string> = {
      name: 'name',
      description: 'description',
      price: 'price',
      category: 'category',
      icon: 'icon',
      isActive: 'is_active',
      sortOrder: 'sort_order',
      applicableTo: 'applicable_to',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if ((input as Record<string, unknown>)[camel] !== undefined) {
        updateData[snake] = (input as Record<string, unknown>)[camel] ?? null;
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('upsell_items')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(tenantId: string, id: string) {
    await this.getById(tenantId, id);

    const { error } = await this.supabase
      .getClient()
      .from('upsell_items')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  /**
   * Seed default upsell items for a new tenant.
   * Called when a tenant is first created.
   */
  async seedDefaults(tenantId: string, userId: string) {
    const defaults = [
      { name: 'Car Exterior Wash', icon: '🚿', price: 15, sortOrder: 1, category: 'service' as const },
      { name: 'Premium Polish & Wax', icon: '✨', price: 45, sortOrder: 2, category: 'service' as const },
      { name: 'Interior Deep Clean', icon: '🧹', price: 35, sortOrder: 3, category: 'service' as const },
      { name: 'Engine Bay Wash', icon: '🔧', price: 25, sortOrder: 4, category: 'service' as const },
      { name: 'AC Sanitization', icon: '❄️', price: 30, sortOrder: 5, category: 'service' as const },
      { name: 'Headlight Restoration', icon: '💡', price: 40, sortOrder: 6, category: 'service' as const },
      { name: 'Wheel Alignment', icon: '🎯', price: 35, sortOrder: 7, category: 'service' as const },
      { name: 'Tire Rotation', icon: '🔄', price: 20, sortOrder: 8, category: 'service' as const },
      { name: 'Oil Change', icon: '🛢️', price: 50, sortOrder: 9, category: 'service' as const },
      { name: 'Brake Fluid Flush', icon: '🛑', price: 45, sortOrder: 10, category: 'service' as const },
      { name: 'Windshield Treatment', icon: '🪟', price: 20, sortOrder: 11, category: 'service' as const },
      { name: 'Paint Protection Film', icon: '🛡️', price: 150, sortOrder: 12, category: 'package' as const },
    ];

    for (const item of defaults) {
      await this.create(tenantId, userId, {
        ...item,
        applicableTo: 'both',
        isActive: true,
      });
    }
  }
}
