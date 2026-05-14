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

  /**
   * Price list preview: project the catalogue's expected sell price for a
   * given (price-group, cost-method) combination. Doesn't write anything —
   * purely a read for the Settings → Pricing visibility page.
   *
   * Each row resolves:
   *   markup_pct  = group rule for the part's category > group default >
   *                 tenant default (already what resolveMarkup does)
   *   unit_cost   = method-aware cost (peekCost wraps the layer logic)
   *   sell_price  = cost × (1 + markup/100), respecting minimum_margin_pct
   */
  async previewPriceList(
    tenantId: string,
    args: { priceGroupId?: string | null; costMethod?: string | null },
  ): Promise<Array<Record<string, unknown>>> {
    const client = this.supabase.getClient();
    const settings = await this.getPricingSettings(tenantId);
    const method = (args.costMethod ?? settings.defaultCostMethod) || 'last_cost';
    const tenantDefault = Number(settings.defaultMarkupPct ?? 0);
    const minMarginPct = Number(settings.minimumMarginPct ?? 0);

    // Resolve the group + its rules in one query so we can look up rules
    // by category without N+1 hits.
    type Rule = { part_category: string; markup_pct: number };
    let groupDefault = tenantDefault;
    const ruleByCategory = new Map<string, number>();
    if (args.priceGroupId) {
      const { data: group } = await client
        .from('price_groups')
        .select('id, default_markup_pct, is_active')
        .eq('id', args.priceGroupId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (group && group.is_active !== false) {
        groupDefault = Number(group.default_markup_pct ?? tenantDefault);
        const { data: rules } = await client
          .from('price_group_rules')
          .select('part_category, markup_pct')
          .eq('price_group_id', args.priceGroupId);
        for (const r of (rules ?? []) as Rule[]) {
          ruleByCategory.set(r.part_category, Number(r.markup_pct));
        }
      }
    }

    const { data: parts } = await client
      .from('parts')
      .select('id, part_number, description, category, unit_cost')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('description', { ascending: true });

    type PartRow = { id: string; part_number: string | null; description: string; category: string | null; unit_cost: number | null };
    const out: Array<Record<string, unknown>> = [];
    for (const p of (parts ?? []) as PartRow[]) {
      const markupPct = p.category && ruleByCategory.has(p.category)
        ? (ruleByCategory.get(p.category) as number)
        : groupDefault;
      // peekCost lives on CostingService — we don't want a circular dep,
      // so resolve the layer-cost inline here using the same algorithm.
      const unitCost = await this.peekCostInline(tenantId, p.id, method);
      let sell = unitCost > 0 ? unitCost * (1 + markupPct / 100) : Number(p.unit_cost ?? 0);
      if (sell > 0 && unitCost > 0 && minMarginPct > 0) {
        const minSell = unitCost / (1 - minMarginPct / 100);
        if (sell < minSell) sell = minSell;
      }
      const margin = sell > 0 ? ((sell - unitCost) / sell) * 100 : 0;
      out.push({
        part_id: p.id,
        part_number: p.part_number,
        description: p.description,
        category: p.category,
        unit_cost: Math.round(unitCost * 100) / 100,
        markup_pct: Math.round(markupPct * 100) / 100,
        sell_price: Math.round(sell * 100) / 100,
        margin_pct: Math.round(margin * 10) / 10,
      });
    }
    return out;
  }

  /**
   * Inline copy of CostingService.peekCost — separate to avoid a circular
   * module dependency. Behaviour must stay in sync; see costing.service.ts.
   */
  private async peekCostInline(
    tenantId: string,
    partId: string,
    method: string,
  ): Promise<number> {
    const client = this.supabase.getClient();
    if (method === 'last_cost') {
      const { data } = await client
        .from('parts')
        .select('unit_cost')
        .eq('id', partId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return Number(data?.unit_cost ?? 0);
    }
    if (method === 'weighted_average') {
      const { data } = await client
        .from('parts_cost_layers')
        .select('unit_cost, quantity_remaining')
        .eq('tenant_id', tenantId)
        .eq('part_id', partId)
        .gt('quantity_remaining', 0);
      const rows = (data ?? []) as Array<{ unit_cost: number; quantity_remaining: number }>;
      const total = rows.reduce((s, l) => s + Number(l.quantity_remaining), 0);
      if (total > 0) {
        return rows.reduce((s, l) => s + Number(l.unit_cost) * Number(l.quantity_remaining), 0) / total;
      }
    }
    if (method === 'fifo' || method === 'lifo') {
      const { data } = await client
        .from('parts_cost_layers')
        .select('unit_cost, received_at')
        .eq('tenant_id', tenantId)
        .eq('part_id', partId)
        .gt('quantity_remaining', 0)
        .order('received_at', { ascending: method === 'fifo' })
        .limit(1);
      const rows = (data ?? []) as Array<{ unit_cost: number; received_at: string }>;
      if (rows[0]) return Number(rows[0].unit_cost);
    }
    if (method === 'highest_cost') {
      const { data } = await client
        .from('parts_cost_layers')
        .select('unit_cost')
        .eq('tenant_id', tenantId)
        .eq('part_id', partId)
        .gt('quantity_remaining', 0)
        .order('unit_cost', { ascending: false })
        .limit(1);
      const top = (data ?? [])[0] as { unit_cost: number } | undefined;
      if (top) return Number(top.unit_cost);
    }
    const { data } = await client
      .from('parts')
      .select('unit_cost')
      .eq('id', partId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    return Number(data?.unit_cost ?? 0);
  }

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
