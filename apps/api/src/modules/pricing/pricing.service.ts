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
      defaultCostMethod: (settings.default_cost_method as string) ?? 'last_cost',
      minimumMarginPct: Number(settings.minimum_margin_pct ?? 0),
    };
  }

  async updatePricingSettings(
    tenantId: string,
    input: { pricingMode?: string; defaultMarkupPct?: number; allowManualOverride?: boolean; defaultCostMethod?: string; minimumMarginPct?: number },
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
    if (input.defaultCostMethod !== undefined) updated.default_cost_method = input.defaultCostMethod;
    if (input.minimumMarginPct !== undefined) updated.minimum_margin_pct = input.minimumMarginPct;

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
      defaultCostMethod: (s.default_cost_method as string) ?? 'last_cost',
      minimumMarginPct: Number(s.minimum_margin_pct ?? 0),
    };
  }

  // ── Copy Rules Between Groups ───────────────────────────────

  async copyGroupRules(
    tenantId: string,
    sourceGroupId: string,
    targetGroupId: string,
  ): Promise<{ copied: number }> {
    const client = this.supabase.getClient();

    // Verify both groups exist and belong to tenant
    await this.getGroup(tenantId, sourceGroupId);
    await this.getGroup(tenantId, targetGroupId);

    // Get source group rules
    const { data: sourceRules, error: srcErr } = await client
      .from('price_group_rules')
      .select('part_category, markup_pct')
      .eq('price_group_id', sourceGroupId)
      .eq('tenant_id', tenantId);

    if (srcErr) throw srcErr;
    if (!sourceRules || sourceRules.length === 0) return { copied: 0 };

    // Get existing target rules to skip duplicates
    const { data: existingRules } = await client
      .from('price_group_rules')
      .select('part_category')
      .eq('price_group_id', targetGroupId)
      .eq('tenant_id', tenantId);

    const existingCategories = new Set(
      (existingRules ?? []).map((r: { part_category: string }) => r.part_category),
    );

    const toInsert = sourceRules
      .filter((r: { part_category: string }) => !existingCategories.has(r.part_category))
      .map((r: { part_category: string; markup_pct: number }) => ({
        tenant_id: tenantId,
        price_group_id: targetGroupId,
        part_category: r.part_category,
        markup_pct: r.markup_pct,
      }));

    if (toInsert.length === 0) return { copied: 0 };

    const { error: insertErr } = await client
      .from('price_group_rules')
      .insert(toInsert);

    if (insertErr) throw insertErr;
    return { copied: toInsert.length };
  }

  // ── Bulk Update Category Markup ─────────────────────────────

  async bulkUpdateCategoryMarkup(
    tenantId: string,
    partCategory: string,
    markupPct: number,
  ): Promise<{ updated: number }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('price_group_rules')
      .update({ markup_pct: markupPct, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('part_category', partCategory)
      .select('id');

    if (error) throw error;
    return { updated: data?.length ?? 0 };
  }

  // ── Bulk Recalculate Sell Prices ────────────────────────────

  async bulkRecalculateSellPrices(
    tenantId: string,
    category?: string,
  ): Promise<{ updated: number }> {
    const client = this.supabase.getClient();

    // Get tenant default markup
    const settings = await this.getPricingSettings(tenantId);
    const defaultMarkup = settings.defaultMarkupPct;

    // Get all parts (optionally filtered by category)
    let query = client
      .from('parts')
      .select('id, unit_cost, category')
      .eq('tenant_id', tenantId);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: parts, error: partsErr } = await query;
    if (partsErr) throw partsErr;
    if (!parts || parts.length === 0) return { updated: 0 };

    let updatedCount = 0;
    for (const part of parts) {
      const unitCost = Number(part.unit_cost ?? 0);
      const sellPrice = Math.round(unitCost * (1 + defaultMarkup / 100) * 100) / 100;

      const { error: updateErr } = await client
        .from('parts')
        .update({ sell_price: sellPrice, updated_at: new Date().toISOString() })
        .eq('id', part.id)
        .eq('tenant_id', tenantId);

      if (!updateErr) updatedCount++;
    }

    return { updated: updatedCount };
  }

  // ── Check Margin ────────────────────────────────────────────

  checkMargin(
    unitCost: number,
    sellPrice: number,
    minimumMarginPct: number,
  ): { marginPct: number; belowMinimum: boolean; warning?: string } {
    const marginPct = unitCost > 0 ? ((sellPrice - unitCost) / sellPrice) * 100 : 0;
    return {
      marginPct: Math.round(marginPct * 100) / 100,
      belowMinimum: marginPct < minimumMarginPct,
      warning:
        marginPct < minimumMarginPct
          ? `Margin ${marginPct.toFixed(1)}% is below minimum ${minimumMarginPct}%`
          : undefined,
    };
  }
}
