import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { JobsService } from './jobs.service';
import { PricingService } from '../pricing/pricing.service';
import type { CreatePartsLineInput, UpdatePartsLineInput } from '@mecanix/validators';

@Injectable()
export class PartsLinesService {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => JobsService))
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

    // Reserve stock if part exists in inventory
    if (input.partNumber) {
      const { data: part } = await this.supabase
        .getClient()
        .from('parts')
        .select('id, stock_qty, reserved_qty')
        .eq('tenant_id', tenantId)
        .eq('part_number', input.partNumber)
        .limit(1)
        .maybeSingle();

      if (part) {
        const currentReserved = Number(part.reserved_qty) || 0;
        const newReserved = currentReserved + input.quantity;
        await this.supabase.getClient()
          .from('parts')
          .update({ reserved_qty: newReserved })
          .eq('id', part.id)
          .eq('tenant_id', tenantId);

        // Update warehouse_stock reserved_qty if warehouse tracking exists
        const { data: whStock } = await this.supabase.getClient()
          .from('warehouse_stock')
          .select('id, reserved_qty')
          .eq('part_id', part.id)
          .eq('tenant_id', tenantId)
          .limit(1)
          .maybeSingle();

        if (whStock) {
          const whReserved = Number(whStock.reserved_qty) || 0;
          await this.supabase.getClient()
            .from('warehouse_stock')
            .update({ reserved_qty: whReserved + input.quantity })
            .eq('id', whStock.id)
            .eq('tenant_id', tenantId);
        }

        // Get vehicle plate for reference
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

        // Record inventory adjustment — reservation
        await this.supabase.getClient()
          .from('inventory_adjustments')
          .insert({
            tenant_id: tenantId,
            part_id: part.id,
            quantity_change: -input.quantity,
            quantity_before: Number(part.stock_qty),
            quantity_after: Number(part.stock_qty),
            reason: `Reserved for job: ${plate}`,
            reference: jobCardId,
          });

        // Update the parts_line with stock_status
        await this.supabase.getClient()
          .from('parts_lines')
          .update({
            stock_status: 'reserved',
            reserved_at: new Date().toISOString(),
          })
          .eq('id', data.id)
          .eq('tenant_id', tenantId);
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

    // Adjust reserved_qty if quantity changed on a reserved line
    if (
      input.quantity !== undefined &&
      input.quantity !== Number(existing.quantity) &&
      existing.stock_status === 'reserved' &&
      existing.part_number
    ) {
      const qtyDiff = input.quantity - Number(existing.quantity);
      const { data: part } = await this.supabase
        .getClient()
        .from('parts')
        .select('id, reserved_qty')
        .eq('tenant_id', tenantId)
        .eq('part_number', existing.part_number as string)
        .limit(1)
        .maybeSingle();

      if (part) {
        const currentReserved = Number(part.reserved_qty) || 0;
        const newReserved = Math.max(0, currentReserved + qtyDiff);
        await this.supabase.getClient()
          .from('parts')
          .update({ reserved_qty: newReserved })
          .eq('id', part.id)
          .eq('tenant_id', tenantId);

        // Also adjust warehouse_stock if applicable
        const { data: whStock } = await this.supabase.getClient()
          .from('warehouse_stock')
          .select('id, reserved_qty')
          .eq('part_id', part.id)
          .eq('tenant_id', tenantId)
          .limit(1)
          .maybeSingle();

        if (whStock) {
          const whReserved = Number(whStock.reserved_qty) || 0;
          await this.supabase.getClient()
            .from('warehouse_stock')
            .update({ reserved_qty: Math.max(0, whReserved + qtyDiff) })
            .eq('id', whStock.id)
            .eq('tenant_id', tenantId);
        }
      }
    }

    await this.jobsService.recalculateTotals(tenantId, existing.job_card_id);

    return data;
  }

  async delete(tenantId: string, id: string, jobCardId: string) {
    // Get line data before deleting (for stock return / reservation release)
    const { data: line } = await this.supabase
      .getClient()
      .from('parts_lines')
      .select('part_number, quantity, stock_status')
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

    // Adjust inventory based on stock_status
    if (line?.part_number) {
      const { data: part } = await this.supabase
        .getClient()
        .from('parts')
        .select('id, stock_qty, reserved_qty')
        .eq('tenant_id', tenantId)
        .eq('part_number', line.part_number as string)
        .limit(1)
        .maybeSingle();

      if (part) {
        const qty = Number(line.quantity) || 0;
        const stockStatus = line.stock_status as string | null;

        if (stockStatus === 'reserved') {
          // Release reservation — decrement reserved_qty, don't touch stock_qty
          const currentReserved = Number(part.reserved_qty) || 0;
          const newReserved = Math.max(0, currentReserved - qty);
          await this.supabase.getClient()
            .from('parts')
            .update({ reserved_qty: newReserved })
            .eq('id', part.id)
            .eq('tenant_id', tenantId);

          // Release warehouse reservation if applicable
          const { data: whStock } = await this.supabase.getClient()
            .from('warehouse_stock')
            .select('id, reserved_qty')
            .eq('part_id', part.id)
            .eq('tenant_id', tenantId)
            .limit(1)
            .maybeSingle();

          if (whStock) {
            const whReserved = Number(whStock.reserved_qty) || 0;
            await this.supabase.getClient()
              .from('warehouse_stock')
              .update({ reserved_qty: Math.max(0, whReserved - qty) })
              .eq('id', whStock.id)
              .eq('tenant_id', tenantId);
          }

          await this.supabase.getClient()
            .from('inventory_adjustments')
            .insert({
              tenant_id: tenantId,
              part_id: part.id,
              quantity_change: qty,
              quantity_before: Number(part.stock_qty),
              quantity_after: Number(part.stock_qty),
              reason: 'Reservation released from job card',
              reference: jobCardId,
            });
        } else if (stockStatus === 'issued') {
          // Return to stock — increment stock_qty (stock was already deducted)
          const currentQty = Number(part.stock_qty);
          const newQty = currentQty + qty;
          await this.supabase.getClient()
            .from('parts')
            .update({ stock_qty: newQty })
            .eq('id', part.id)
            .eq('tenant_id', tenantId);

          // Return to warehouse stock if applicable
          const { data: whStock } = await this.supabase.getClient()
            .from('warehouse_stock')
            .select('id, quantity')
            .eq('part_id', part.id)
            .eq('tenant_id', tenantId)
            .limit(1)
            .maybeSingle();

          if (whStock) {
            const whQty = Number(whStock.quantity) || 0;
            await this.supabase.getClient()
              .from('warehouse_stock')
              .update({ quantity: whQty + qty })
              .eq('id', whStock.id)
              .eq('tenant_id', tenantId);
          }

          await this.supabase.getClient()
            .from('inventory_adjustments')
            .insert({
              tenant_id: tenantId,
              part_id: part.id,
              quantity_change: qty,
              quantity_before: Number(part.stock_qty),
              quantity_after: Number(part.stock_qty) + qty,
              reason: 'Returned from job card (issued)',
              reference: jobCardId,
            });
        }
      }
    }

    await this.jobsService.recalculateTotals(tenantId, jobCardId);

    return { deleted: true };
  }

  /**
   * Issue all reserved parts on a job card.
   * Transitions parts_lines from 'reserved' → 'issued':
   *   - Deducts parts.stock_qty
   *   - Decrements parts.reserved_qty
   *   - Updates warehouse_stock if applicable
   *   - Creates inventory_adjustment records
   */
  async issueParts(tenantId: string, jobCardId: string): Promise<number> {
    const client = this.supabase.getClient();

    // Get all reserved parts lines for this job
    const { data: reservedLines, error: fetchErr } = await client
      .from('parts_lines')
      .select('id, part_number, quantity')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .eq('stock_status', 'reserved');

    if (fetchErr) throw fetchErr;
    if (!reservedLines || reservedLines.length === 0) return 0;

    // Get vehicle plate for adjustment reason
    const { data: job } = await client
      .from('job_cards')
      .select('vehicle:vehicles(plate)')
      .eq('id', jobCardId)
      .eq('tenant_id', tenantId)
      .single();

    const vehicleData = job?.vehicle as unknown;
    const plate = (vehicleData && typeof vehicleData === 'object' && 'plate' in (vehicleData as Record<string, unknown>))
      ? String((vehicleData as Record<string, unknown>).plate)
      : '';

    let issuedCount = 0;

    for (const line of reservedLines) {
      if (!line.part_number) continue;

      const { data: part } = await client
        .from('parts')
        .select('id, stock_qty, reserved_qty')
        .eq('tenant_id', tenantId)
        .eq('part_number', line.part_number as string)
        .limit(1)
        .maybeSingle();

      if (!part) continue;

      const qty = Number(line.quantity) || 0;
      const currentStockQty = Number(part.stock_qty);
      const currentReserved = Number(part.reserved_qty) || 0;
      const newStockQty = Math.max(0, currentStockQty - qty);
      const newReserved = Math.max(0, currentReserved - qty);

      // Deduct stock and decrement reservation
      await client
        .from('parts')
        .update({ stock_qty: newStockQty, reserved_qty: newReserved })
        .eq('id', part.id)
        .eq('tenant_id', tenantId);

      // Update warehouse_stock if applicable
      const { data: whStock } = await client
        .from('warehouse_stock')
        .select('id, quantity, reserved_qty')
        .eq('part_id', part.id)
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();

      if (whStock) {
        const whQty = Number(whStock.quantity) || 0;
        const whReserved = Number(whStock.reserved_qty) || 0;
        await client
          .from('warehouse_stock')
          .update({
            quantity: Math.max(0, whQty - qty),
            reserved_qty: Math.max(0, whReserved - qty),
          })
          .eq('id', whStock.id)
          .eq('tenant_id', tenantId);
      }

      // Record inventory adjustment
      await client
        .from('inventory_adjustments')
        .insert({
          tenant_id: tenantId,
          part_id: part.id,
          quantity_change: -qty,
          quantity_before: currentStockQty,
          quantity_after: newStockQty,
          reason: `Issued to job: ${plate}`,
          reference: jobCardId,
        });

      // Update parts_line status to issued
      await client
        .from('parts_lines')
        .update({
          stock_status: 'issued',
          issued_at: new Date().toISOString(),
        })
        .eq('id', line.id)
        .eq('tenant_id', tenantId);

      issuedCount++;
    }

    return issuedCount;
  }
}
