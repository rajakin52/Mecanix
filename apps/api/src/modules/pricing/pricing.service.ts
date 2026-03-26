import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreatePriceGroupInput, UpdatePriceGroupInput, CreatePriceGroupRuleInput } from '@mecanix/validators';

@Injectable()
export class PricingService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Price Groups ──────────────────────────────────────────

  async listGroups(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('price_groups')
      .select('*, rules:price_group_rules(*)')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) throw error;
    return data ?? [];
  }

  async getGroup(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('price_groups')
      .select('*, rules:price_group_rules(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Price group not found');
    return data;
  }

  async createGroup(tenantId: string, userId: string, input: CreatePriceGroupInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('price_groups')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        description: input.description || null,
        default_markup_pct: input.defaultMarkupPct,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateGroup(tenantId: string, id: string, input: UpdatePriceGroupInput) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.defaultMarkupPct !== undefined) updates.default_markup_pct = input.defaultMarkupPct;
    if (input.isActive !== undefined) updates.is_active = input.isActive;

    const { data, error } = await this.supabase
      .getClient()
      .from('price_groups')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteGroup(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('price_groups')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  // ── Price Group Rules ─────────────────────────────────────

  async addRule(tenantId: string, groupId: string, input: CreatePriceGroupRuleInput) {
    // Verify group exists
    await this.getGroup(tenantId, groupId);

    const { data, error } = await this.supabase
      .getClient()
      .from('price_group_rules')
      .upsert(
        {
          tenant_id: tenantId,
          price_group_id: groupId,
          part_category: input.partCategory,
          markup_pct: input.markupPct,
        },
        { onConflict: 'price_group_id,part_category' },
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteRule(tenantId: string, ruleId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('price_group_rules')
      .delete()
      .eq('id', ruleId)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  // ── Markup Resolution Engine ──────────────────────────────
  //
  // Priority: group + category rule → group default → tenant default
  //

  async resolveMarkup(
    tenantId: string,
    customerId: string | null,
    partCategory: string | null,
  ): Promise<{ markupPct: number; source: string }> {
    const client = this.supabase.getClient();

    // 1. Get customer's price group
    if (customerId) {
      const { data: customer } = await client
        .from('customers')
        .select('price_group_id')
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
        .single();

      if (customer?.price_group_id) {
        const { data: group } = await client
          .from('price_groups')
          .select('default_markup_pct')
          .eq('id', customer.price_group_id)
          .eq('is_active', true)
          .single();

        if (group) {
          // 1a. Check category-specific rule
          if (partCategory) {
            const { data: rule } = await client
              .from('price_group_rules')
              .select('markup_pct')
              .eq('price_group_id', customer.price_group_id)
              .eq('part_category', partCategory)
              .single();

            if (rule) {
              return {
                markupPct: Number(rule.markup_pct),
                source: `group_category`,
              };
            }
          }

          // 1b. Group default
          return {
            markupPct: Number(group.default_markup_pct),
            source: 'group_default',
          };
        }
      }
    }

    // 2. Tenant default
    const { data: tenant } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    const settings = (tenant?.settings as Record<string, unknown>) ?? {};
    const defaultPct = Number(settings.default_markup_pct ?? 0);

    return { markupPct: defaultPct, source: 'tenant_default' };
  }

  // ── Pricing Settings ──────────────────────────────────────

  async getPricingSettings(tenantId: string) {
    const { data } = await this.supabase
      .getClient()
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    const settings = (data?.settings as Record<string, unknown>) ?? {};
    return {
      pricingMode: (settings.pricing_mode as string) ?? 'manual',
      defaultMarkupPct: Number(settings.default_markup_pct ?? 0),
      allowManualOverride: Boolean(settings.allow_manual_override ?? true),
    };
  }

  async updatePricingSettings(
    tenantId: string,
    input: { pricingMode?: string; defaultMarkupPct?: number; allowManualOverride?: boolean },
  ) {
    const { data: tenant } = await this.supabase
      .getClient()
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    const current = (tenant?.settings as Record<string, unknown>) ?? {};
    const updated = { ...current };

    if (input.pricingMode !== undefined) updated.pricing_mode = input.pricingMode;
    if (input.defaultMarkupPct !== undefined) updated.default_markup_pct = input.defaultMarkupPct;
    if (input.allowManualOverride !== undefined) updated.allow_manual_override = input.allowManualOverride;

    const { data, error } = await this.supabase
      .getClient()
      .from('tenants')
      .update({ settings: updated })
      .eq('id', tenantId)
      .select('settings')
      .single();

    if (error) throw error;

    const s = (data?.settings as Record<string, unknown>) ?? {};
    return {
      pricingMode: (s.pricing_mode as string) ?? 'manual',
      defaultMarkupPct: Number(s.default_markup_pct ?? 0),
      allowManualOverride: Boolean(s.allow_manual_override ?? true),
    };
  }
}
