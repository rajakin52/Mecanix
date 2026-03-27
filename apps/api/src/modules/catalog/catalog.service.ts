import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PricingService } from '../pricing/pricing.service';
import { JobsService } from '../jobs/jobs.service';
import type { CreateCatalogItemInput, UpdateCatalogItemInput } from '@mecanix/validators';

@Injectable()
export class CatalogService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly pricingService: PricingService,
    private readonly jobsService: JobsService,
  ) {}

  async list(tenantId: string, type?: string, category?: string, quickAccessOnly?: boolean, search?: string) {
    const client = this.supabase.getClient();
    let query = client
      .from('repair_catalog')
      .select('*, labour_items:repair_catalog_labour_items(*), parts_items:repair_catalog_parts_items(*)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (quickAccessOnly) query = query.eq('quick_access', true);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('repair_catalog')
      .select('*, labour_items:repair_catalog_labour_items(*), parts_items:repair_catalog_parts_items(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Catalog item not found');
    return data;
  }

  async create(tenantId: string, userId: string, input: CreateCatalogItemInput) {
    const client = this.supabase.getClient();

    const { data: item, error } = await client
      .from('repair_catalog')
      .insert({
        tenant_id: tenantId,
        type: input.type,
        code: input.code || null,
        name: input.name,
        description: input.description || null,
        category: input.category || null,
        vehicle_types: input.vehicleTypes || null,
        mileage_interval: input.mileageInterval || null,
        estimated_hours: input.estimatedHours || null,
        fixed_price: input.fixedPrice || null,
        quick_access: input.quickAccess ?? false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Insert labour items
    if (input.labourItems?.length) {
      const { error: labourErr } = await client
        .from('repair_catalog_labour_items')
        .insert(
          input.labourItems.map((li, i) => ({
            tenant_id: tenantId,
            catalog_id: item.id,
            description: li.description,
            hours: li.hours,
            rate: li.rate,
            sort_order: i,
          })),
        );
      if (labourErr) throw labourErr;
    }

    // Insert parts items
    if (input.partsItems?.length) {
      const { error: partsErr } = await client
        .from('repair_catalog_parts_items')
        .insert(
          input.partsItems.map((pi, i) => ({
            tenant_id: tenantId,
            catalog_id: item.id,
            part_id: pi.partId || null,
            part_name: pi.partName,
            part_number: pi.partNumber || null,
            quantity: pi.quantity,
            unit_cost: pi.unitCost,
            markup_pct: pi.markupPct ?? 0,
            sort_order: i,
          })),
        );
      if (partsErr) throw partsErr;
    }

    return this.getById(tenantId, item.id);
  }

  async update(tenantId: string, id: string, input: UpdateCatalogItemInput) {
    const client = this.supabase.getClient();
    await this.getById(tenantId, id);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.type !== undefined) updates.type = input.type;
    if (input.code !== undefined) updates.code = input.code || null;
    if (input.description !== undefined) updates.description = input.description || null;
    if (input.category !== undefined) updates.category = input.category || null;
    if (input.vehicleTypes !== undefined) updates.vehicle_types = input.vehicleTypes;
    if (input.mileageInterval !== undefined) updates.mileage_interval = input.mileageInterval;
    if (input.estimatedHours !== undefined) updates.estimated_hours = input.estimatedHours;
    if (input.fixedPrice !== undefined) updates.fixed_price = input.fixedPrice;
    if (input.quickAccess !== undefined) updates.quick_access = input.quickAccess;
    if (input.isActive !== undefined) updates.is_active = input.isActive;

    const { error } = await client
      .from('repair_catalog')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Replace labour items if provided
    if (input.labourItems !== undefined) {
      await client.from('repair_catalog_labour_items').delete().eq('catalog_id', id).eq('tenant_id', tenantId);
      if (input.labourItems.length > 0) {
        await client.from('repair_catalog_labour_items').insert(
          input.labourItems.map((li, i) => ({
            tenant_id: tenantId,
            catalog_id: id,
            description: li.description,
            hours: li.hours,
            rate: li.rate,
            sort_order: i,
          })),
        );
      }
    }

    // Replace parts items if provided
    if (input.partsItems !== undefined) {
      await client.from('repair_catalog_parts_items').delete().eq('catalog_id', id).eq('tenant_id', tenantId);
      if (input.partsItems.length > 0) {
        await client.from('repair_catalog_parts_items').insert(
          input.partsItems.map((pi, i) => ({
            tenant_id: tenantId,
            catalog_id: id,
            part_id: pi.partId || null,
            part_name: pi.partName,
            part_number: pi.partNumber || null,
            quantity: pi.quantity,
            unit_cost: pi.unitCost,
            markup_pct: pi.markupPct ?? 0,
            sort_order: i,
          })),
        );
      }
    }

    return this.getById(tenantId, id);
  }

  async delete(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('repair_catalog')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  async categories(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('repair_catalog')
      .select('category')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('category', 'is', null);

    if (error) throw error;
    const cats = [...new Set((data ?? []).map((d) => d.category as string))].sort();
    return cats;
  }

  // Apply catalog item to a job card — creates labour + parts lines
  async applyToJob(tenantId: string, userId: string, jobCardId: string, catalogItemId: string) {
    const item = await this.getById(tenantId, catalogItemId);
    const client = this.supabase.getClient();

    // Get job's customer for pricing
    const { data: job } = await client
      .from('job_cards')
      .select('customer_id')
      .eq('id', jobCardId)
      .eq('tenant_id', tenantId)
      .single();

    // Create labour lines
    const labourItems = (item.labour_items ?? []) as Array<Record<string, unknown>>;
    for (const li of labourItems) {
      const hours = Number(li.hours) || 0;
      const rate = Number(li.rate) || 0;
      await client.from('labour_lines').insert({
        tenant_id: tenantId,
        job_card_id: jobCardId,
        description: li.description,
        hours,
        rate,
        subtotal: Math.round(hours * rate * 100) / 100,
      });
    }

    // Create parts lines with pricing
    const partsItems = (item.parts_items ?? []) as Array<Record<string, unknown>>;
    for (const pi of partsItems) {
      const qty = Number(pi.quantity) || 1;
      const unitCost = Number(pi.unit_cost) || 0;

      // Resolve markup from pricing engine
      let markupPct = Number(pi.markup_pct) || 0;
      const partCategory = (pi.part_name as string) ?? '';
      try {
        const resolved = await this.pricingService.resolveMarkup(
          tenantId,
          job?.customer_id ?? null,
          partCategory,
        );
        if (resolved.markupPct > 0) markupPct = resolved.markupPct;
      } catch { /* use catalog default */ }

      const sellPrice = Math.round(unitCost * (1 + markupPct / 100) * 100) / 100;
      const subtotal = Math.round(qty * sellPrice * 100) / 100;

      await client.from('parts_lines').insert({
        tenant_id: tenantId,
        job_card_id: jobCardId,
        part_name: pi.part_name,
        part_number: pi.part_number || null,
        part_id: pi.part_id || null,
        quantity: qty,
        unit_cost: unitCost,
        markup_pct: markupPct,
        sell_price: sellPrice,
        subtotal,
      });
    }

    // Recalculate job totals
    await this.jobsService.recalculateTotals(tenantId, jobCardId);

    return { applied: true, labourLines: labourItems.length, partsLines: partsItems.length };
  }
}
