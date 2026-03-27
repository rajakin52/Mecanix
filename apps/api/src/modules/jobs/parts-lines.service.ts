import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { JobsService } from './jobs.service';
import { PricingService } from '../pricing/pricing.service';
import type { CreatePartsLineInput, UpdatePartsLineInput } from '@mecanix/validators';

@Injectable()
export class PartsLinesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jobsService: JobsService,
    private readonly pricingService: PricingService,
  ) {}

  async list(tenantId: string, jobCardId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('parts_lines')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async create(
    tenantId: string,
    jobCardId: string,
    userId: string,
    input: CreatePartsLineInput,
  ) {
    // Get pricing settings
    const pricingSettings = await this.pricingService.getPricingSettings(tenantId);

    let markupPct = input.markupPct ?? 0;
    let priceOverridden = false;
    let originalMarkupPct: number | null = null;

    // In automatic mode, resolve markup from pricing engine
    if (pricingSettings.pricingMode === 'automatic') {
      // Look up the job's customer
      const { data: job } = await this.supabase
        .getClient()
        .from('job_cards')
        .select('customer_id')
        .eq('id', jobCardId)
        .eq('tenant_id', tenantId)
        .single();

      // Look up part category if we have a part reference
      let partCategory: string | null = null;
      if (input.partNumber) {
        const { data: part } = await this.supabase
          .getClient()
          .from('parts')
          .select('category')
          .eq('tenant_id', tenantId)
          .eq('part_number', input.partNumber)
          .limit(1)
          .maybeSingle();
        partCategory = part?.category ?? null;
      }

      const resolved = await this.pricingService.resolveMarkup(
        tenantId,
        job?.customer_id ?? null,
        partCategory,
      );

      originalMarkupPct = resolved.markupPct;

      // If user provided a different markup and override is allowed, mark as overridden
      if (input.markupPct !== undefined && input.markupPct !== resolved.markupPct) {
        if (pricingSettings.allowManualOverride) {
          markupPct = input.markupPct;
          priceOverridden = true;
        } else {
          // Override not allowed — use resolved
          markupPct = resolved.markupPct;
        }
      } else {
        markupPct = resolved.markupPct;
      }
    }

    const sellPrice = Math.round(input.unitCost * (1 + markupPct / 100) * 100) / 100;
    const subtotal = Math.round(input.quantity * sellPrice * 100) / 100;

    const { data, error } = await this.supabase
      .getClient()
      .from('parts_lines')
      .insert({
        tenant_id: tenantId,
        job_card_id: jobCardId,
        part_name: input.partName,
        part_number: input.partNumber || null,
        quantity: input.quantity,
        unit_cost: input.unitCost,
        markup_pct: markupPct,
        sell_price: sellPrice,
        subtotal,
        price_overridden: priceOverridden,
        original_markup_pct: originalMarkupPct,
      })
      .select()
      .single();

    if (error) throw error;

    // Deduct stock if part exists in inventory
    if (input.partNumber) {
      const { data: part } = await this.supabase
        .getClient()
        .from('parts')
        .select('id, stock_qty')
        .eq('tenant_id', tenantId)
        .eq('part_number', input.partNumber)
        .limit(1)
        .maybeSingle();

      if (part) {
        const currentQty = Number(part.stock_qty);
        const newQty = Math.max(0, currentQty - input.quantity);
        await this.supabase.getClient()
          .from('parts')
          .update({ stock_qty: newQty })
          .eq('id', part.id)
          .eq('tenant_id', tenantId);

        // Get vehicle plate for reclassification reference
        const { data: job } = await this.supabase.getClient()
          .from('job_cards')
          .select('vehicle:vehicles(plate)')
          .eq('id', jobCardId)
          .eq('tenant_id', tenantId)
          .single();

        const vehicleData = job?.vehicle as unknown;
        const plate = (vehicleData && typeof vehicleData === 'object' && 'plate' in (vehicleData as Record<string, unknown>))
          ? String((vehicleData as Record<string, unknown>).plate)
          : '';

        // Record inventory adjustment — reclassification: Garage Stock → Vehicle
        await this.supabase.getClient()
          .from('inventory_adjustments')
          .insert({
            tenant_id: tenantId,
            part_id: part.id,
            quantity_change: -input.quantity,
            quantity_before: currentQty,
            quantity_after: newQty,
            reason: `Reclassification: Garage Stock → ${plate}`,
            reference: jobCardId,
          });
      }
    }

    await this.jobsService.recalculateTotals(tenantId, jobCardId);

    return data;
  }

  async update(
    tenantId: string,
    id: string,
    userId: string,
    input: UpdatePartsLineInput,
  ) {
    const { data: existing, error: fetchError } = await this.supabase
      .getClient()
      .from('parts_lines')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException('Parts line not found');
    }

    const unitCost = input.unitCost ?? existing.unit_cost;
    const markupPct = input.markupPct ?? existing.markup_pct;
    const quantity = input.quantity ?? existing.quantity;
    const sellPrice = Math.round(unitCost * (1 + markupPct / 100) * 100) / 100;
    const subtotal = Math.round(quantity * sellPrice * 100) / 100;

    const updateData: Record<string, unknown> = {
      sell_price: sellPrice,
      subtotal,
    };

    if (input.partName !== undefined) updateData['part_name'] = input.partName;
    if (input.partNumber !== undefined) updateData['part_number'] = input.partNumber || null;
    if (input.quantity !== undefined) updateData['quantity'] = input.quantity;
    if (input.unitCost !== undefined) updateData['unit_cost'] = input.unitCost;
    if (input.markupPct !== undefined) {
      updateData['markup_pct'] = input.markupPct;
      // Track if user overrides the original resolved markup
      if (existing.original_markup_pct != null && input.markupPct !== Number(existing.original_markup_pct)) {
        updateData['price_overridden'] = true;
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('parts_lines')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    await this.jobsService.recalculateTotals(tenantId, existing.job_card_id);

    return data;
  }

  async delete(tenantId: string, id: string, jobCardId: string) {
    // Get line data before deleting (for stock return)
    const { data: line } = await this.supabase
      .getClient()
      .from('parts_lines')
      .select('part_number, quantity')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const { error } = await this.supabase
      .getClient()
      .from('parts_lines')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    // Return stock if part exists
    if (line?.part_number) {
      const { data: part } = await this.supabase
        .getClient()
        .from('parts')
        .select('id, stock_qty')
        .eq('tenant_id', tenantId)
        .eq('part_number', line.part_number as string)
        .limit(1)
        .maybeSingle();

      if (part) {
        const qty = Number(line.quantity) || 0;
        const newQty = Number(part.stock_qty) + qty;
        await this.supabase.getClient()
          .from('parts')
          .update({ stock_qty: newQty })
          .eq('id', part.id)
          .eq('tenant_id', tenantId);

        await this.supabase.getClient()
          .from('inventory_adjustments')
          .insert({
            tenant_id: tenantId,
            part_id: part.id,
            quantity_change: qty,
            quantity_before: part.stock_qty,
            quantity_after: newQty,
            reason: 'Returned from job card',
            reference: jobCardId,
          });
      }
    }

    await this.jobsService.recalculateTotals(tenantId, jobCardId);

    return { deleted: true };
  }
}
