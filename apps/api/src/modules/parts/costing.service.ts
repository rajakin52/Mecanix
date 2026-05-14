import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Cost price calculation service.
 * Supports: Last Cost, Weighted Average Cost (WAC), FIFO.
 */
@Injectable()
export class CostingService {
  private readonly logger = new Logger('CostingService');

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get the cost method for a part (part-level override or tenant default).
   */
  async getCostMethod(tenantId: string, partId: string): Promise<string> {
    const client = this.supabase.getClient();

    // Check part-level override
    const { data: part } = await client
      .from('parts')
      .select('cost_method')
      .eq('id', partId)
      .eq('tenant_id', tenantId)
      .single();

    if (part?.cost_method) return part.cost_method as string;

    // Tenant default
    const { data: tenant } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .single();

    const settings = (tenant?.settings as Record<string, unknown>) ?? {};
    return (settings.default_cost_method as string) ?? 'last_cost';
  }

  /**
   * Recalculate unit_cost after receiving goods.
   *
   * @param tenantId - Tenant ID
   * @param partId - Part ID
   * @param receivedQty - Quantity being received
   * @param purchaseUnitCost - Cost per unit on the PO line
   * @param landedUnitCost - Cost per unit after landed cost distribution (optional)
   */
  async recalculateCost(
    tenantId: string,
    partId: string,
    receivedQty: number,
    purchaseUnitCost: number,
    landedUnitCost?: number,
  ): Promise<{ newCost: number; method: string }> {
    const client = this.supabase.getClient();
    const method = await this.getCostMethod(tenantId, partId);
    const effectiveCost = landedUnitCost ?? purchaseUnitCost;

    // Get current part data
    const { data: part } = await client
      .from('parts')
      .select('unit_cost, stock_qty, cost_history')
      .eq('id', partId)
      .eq('tenant_id', tenantId)
      .single();

    if (!part) {
      return { newCost: effectiveCost, method };
    }

    const currentCost = Number(part.unit_cost) || 0;
    const currentQty = Number(part.stock_qty) || 0;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    let newCost: number;

    switch (method) {
      case 'weighted_average': {
        // WAC = (currentQty * currentCost + receivedQty * effectiveCost) / totalQty
        const totalQty = currentQty + receivedQty;
        if (totalQty <= 0) {
          newCost = effectiveCost;
        } else {
          newCost = round2(
            (currentQty * currentCost + receivedQty * effectiveCost) / totalQty,
          );
        }
        break;
      }

      case 'fifo': {
        // FIFO: cost = oldest batch cost. We track batches in cost_history.
        // For simplicity, store the new batch and use the oldest unexpired batch cost.
        const history = (part.cost_history as Array<Record<string, unknown>>) ?? [];
        history.push({
          date: new Date().toISOString(),
          qty: receivedQty,
          cost: effectiveCost,
          remaining: receivedQty,
        });

        // FIFO cost = cost of the oldest batch with remaining stock
        const oldestBatch = history.find((b) => (Number(b.remaining) || 0) > 0);
        newCost = oldestBatch ? round2(Number(oldestBatch.cost)) : effectiveCost;

        // Save updated history
        await client
          .from('parts')
          .update({ cost_history: history })
          .eq('id', partId)
          .eq('tenant_id', tenantId);

        break;
      }

      case 'last_cost':
      default: {
        // Last Cost = just use the latest purchase price
        newCost = round2(effectiveCost);
        break;
      }
    }

    // Update part cost
    await client
      .from('parts')
      .update({
        unit_cost: newCost,
        updated_at: new Date().toISOString(),
      })
      .eq('id', partId)
      .eq('tenant_id', tenantId);

    // Append to cost history
    const history = ((part.cost_history as Array<Record<string, unknown>>) ?? []).slice(-50); // Keep last 50
    history.push({
      date: new Date().toISOString(),
      method,
      previousCost: currentCost,
      newCost,
      receivedQty,
      purchaseUnitCost,
      landedUnitCost: landedUnitCost ?? null,
    });

    await client
      .from('parts')
      .update({ cost_history: history })
      .eq('id', partId)
      .eq('tenant_id', tenantId);

    this.logger.log(`Part ${partId}: cost ${currentCost} → ${newCost} (${method})`);

    return { newCost, method };
  }

  /**
   * Distribute additional costs (freight, customs, handling, etc.) across
   * PO lines according to each cost's allocation method:
   *   - by_value: proportional to line value (unit_cost × quantity). Standard
   *     for freight / insurance — bigger-ticket items absorb more.
   *   - by_quantity: equal share per unit. Standard for fixed-per-item costs
   *     like customs broker / clearing fees / per-line handling.
   *
   * Each cost is distributed independently then summed into the final
   * landed unit cost.
   */
  distributeLandedCosts(
    lines: Array<{ unitCost: number; quantity: number }>,
    additionalCosts: Array<{ type: string; amount: number; allocation_method?: 'by_value' | 'by_quantity' }>,
  ): number[] {
    if (lines.length === 0) return [];

    const totalPOValue = lines.reduce((sum, l) => sum + l.unitCost * l.quantity, 0);
    const totalPOQty = lines.reduce((sum, l) => sum + l.quantity, 0);

    // Accumulated per-unit add-on for each line
    const perUnitAddOn = lines.map(() => 0);

    for (const cost of additionalCosts) {
      const amount = Number(cost.amount) || 0;
      if (amount <= 0) continue;
      const method = cost.allocation_method ?? 'by_value';

      if (method === 'by_quantity') {
        if (totalPOQty <= 0) continue;
        const perUnit = amount / totalPOQty;
        for (let i = 0; i < lines.length; i++) {
          perUnitAddOn[i] = (perUnitAddOn[i] ?? 0) + perUnit;
        }
      } else {
        // by_value (default)
        if (totalPOValue <= 0) continue;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const lineValue = line.unitCost * line.quantity;
          const proportion = lineValue / totalPOValue;
          if (line.quantity > 0) {
            perUnitAddOn[i] = (perUnitAddOn[i] ?? 0) + (amount * proportion) / line.quantity;
          }
        }
      }
    }

    return lines.map((line, i) =>
      Math.round((line.unitCost + (perUnitAddOn[i] ?? 0)) * 100) / 100,
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Cost-layer ledger (FIFO / LIFO / WAC)
  // ──────────────────────────────────────────────────────────────────────
  // Maintains parts_cost_layers (migration 00120). recordReceipt writes a
  // layer; consume draws layers down per the chosen method and returns the
  // unit cost actually drawn (caller snapshots that onto parts_lines.unit_cost
  // for accurate historical COGS). peekCost computes the cost without
  // consuming, for previews and reports.

  /**
   * Write a new cost layer when stock arrives. Idempotent across re-runs
   * only if the caller passes the same sourceReference (we don't enforce
   * uniqueness; receiveGoods is the caller and is itself idempotent on
   * received_qty).
   */
  async recordReceipt(args: {
    tenantId: string;
    partId: string;
    warehouseId?: string | null;
    qty: number;
    unitCost: number;
    sourceType?: 'po_receipt' | 'opening_balance' | 'adjustment' | 'return' | 'manual';
    sourceReference?: string | null;
    userId?: string | null;
    notes?: string | null;
  }): Promise<void> {
    if (args.qty <= 0) return;
    const { error } = await this.supabase
      .getClient()
      .from('parts_cost_layers')
      .insert({
        tenant_id: args.tenantId,
        part_id: args.partId,
        warehouse_id: args.warehouseId ?? null,
        unit_cost: args.unitCost,
        quantity_received: args.qty,
        quantity_remaining: args.qty,
        source_type: args.sourceType ?? 'po_receipt',
        source_reference: args.sourceReference ?? null,
        created_by: args.userId ?? null,
        notes: args.notes ?? null,
      });
    if (error) {
      this.logger.error(`Cost layer insert failed for part ${args.partId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Consume `qty` units from the part's cost layers per the chosen method
   * and return the *weighted-average* unit cost the consumer should snapshot
   * onto its line. Decrements quantity_remaining in-place.
   *
   * - last_cost: skip layers entirely, return parts.unit_cost
   * - fifo:      draw oldest-first (received_at asc)
   * - lifo:      draw newest-first (received_at desc)
   * - weighted_average: prorate across every layer with qty > 0
   *
   * If layers run dry the consumer still gets a reasonable answer — for
   * FIFO/LIFO it falls back to parts.unit_cost for the unfilled qty. WAC
   * uses the current WAC for any shortfall. Treat shortfalls as a soft
   * warning, not a hard failure — stock can go negative in some flows.
   */
  async consume(
    tenantId: string,
    partId: string,
    qty: number,
    methodOverride?: string,
  ): Promise<{ unitCost: number; method: string; layersConsumed: number; shortfall: number }> {
    if (qty <= 0) return { unitCost: 0, method: 'noop', layersConsumed: 0, shortfall: 0 };
    const method = methodOverride ?? (await this.getCostMethod(tenantId, partId));
    const client = this.supabase.getClient();

    // last_cost: nothing to consume — pricing engine already drove the
    // unit_cost snapshot upstream. Return parts.unit_cost so callers can
    // unify the snapshot logic.
    if (method === 'last_cost') {
      const { data: part } = await client
        .from('parts')
        .select('unit_cost')
        .eq('id', partId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      return {
        unitCost: Number(part?.unit_cost ?? 0),
        method,
        layersConsumed: 0,
        shortfall: 0,
      };
    }

    if (method === 'weighted_average') {
      const { data: layers } = await client
        .from('parts_cost_layers')
        .select('id, unit_cost, quantity_remaining')
        .eq('tenant_id', tenantId)
        .eq('part_id', partId)
        .gt('quantity_remaining', 0);
      const rows = (layers ?? []) as Array<{ id: string; unit_cost: number; quantity_remaining: number }>;
      const totalQty = rows.reduce((s, l) => s + Number(l.quantity_remaining), 0);
      const wac = totalQty > 0
        ? rows.reduce((s, l) => s + Number(l.unit_cost) * Number(l.quantity_remaining), 0) / totalQty
        : 0;
      const fallback = wac > 0 ? wac : Number((await this.getCurrentCostFallback(tenantId, partId)));
      const drawn = Math.min(totalQty, qty);
      // Prorated draw — every layer loses qty × (layer.qr / totalQty).
      let layersConsumed = 0;
      if (totalQty > 0) {
        for (const l of rows) {
          const take = (Number(l.quantity_remaining) / totalQty) * drawn;
          if (take <= 0) continue;
          const next = Math.max(0, Number(l.quantity_remaining) - take);
          await client
            .from('parts_cost_layers')
            .update({ quantity_remaining: next })
            .eq('id', l.id)
            .eq('tenant_id', tenantId);
          layersConsumed++;
        }
      }
      return {
        unitCost: Math.round(fallback * 10000) / 10000,
        method,
        layersConsumed,
        shortfall: Math.max(0, qty - drawn),
      };
    }

    // highest_cost: charge the most-expensive layer currently in stock
    // (conservative — never undercut your most expensive purchase). Draws
    // layers from highest unit_cost down until qty is satisfied.
    if (method === 'highest_cost') {
      const { data: layers } = await client
        .from('parts_cost_layers')
        .select('id, unit_cost, quantity_remaining')
        .eq('tenant_id', tenantId)
        .eq('part_id', partId)
        .gt('quantity_remaining', 0)
        .order('unit_cost', { ascending: false });
      const rows = (layers ?? []) as Array<{ id: string; unit_cost: number; quantity_remaining: number }>;
      let remaining = qty;
      let totalCost = 0;
      let drawn = 0;
      let layersConsumed = 0;
      for (const layer of rows) {
        if (remaining <= 0) break;
        const take = Math.min(Number(layer.quantity_remaining), remaining);
        totalCost += take * Number(layer.unit_cost);
        drawn += take;
        remaining -= take;
        await client
          .from('parts_cost_layers')
          .update({ quantity_remaining: Math.max(0, Number(layer.quantity_remaining) - take) })
          .eq('id', layer.id)
          .eq('tenant_id', tenantId);
        layersConsumed++;
      }
      let unitCost = drawn > 0 ? totalCost / drawn : 0;
      if (remaining > 0) {
        const fallback = await this.getCurrentCostFallback(tenantId, partId);
        unitCost = (totalCost + remaining * fallback) / qty;
      }
      return {
        unitCost: Math.round(unitCost * 10000) / 10000,
        method,
        layersConsumed,
        shortfall: Math.max(0, remaining),
      };
    }

    // FIFO / LIFO: draw layers one at a time in the appropriate order
    // until qty is satisfied or we run out.
    const fifo = method !== 'lifo';
    const { data: layers } = await client
      .from('parts_cost_layers')
      .select('id, unit_cost, quantity_remaining, received_at')
      .eq('tenant_id', tenantId)
      .eq('part_id', partId)
      .gt('quantity_remaining', 0)
      .order('received_at', { ascending: fifo });
    const rows = (layers ?? []) as Array<{ id: string; unit_cost: number; quantity_remaining: number; received_at: string }>;

    let remaining = qty;
    let totalCost = 0;
    let drawnQty = 0;
    let layersConsumed = 0;
    for (const layer of rows) {
      if (remaining <= 0) break;
      const available = Number(layer.quantity_remaining);
      const take = Math.min(available, remaining);
      totalCost += take * Number(layer.unit_cost);
      drawnQty += take;
      remaining -= take;
      const newRemaining = Math.max(0, available - take);
      await client
        .from('parts_cost_layers')
        .update({ quantity_remaining: newRemaining })
        .eq('id', layer.id)
        .eq('tenant_id', tenantId);
      layersConsumed++;
    }

    let unitCost = drawnQty > 0 ? totalCost / drawnQty : 0;
    if (remaining > 0) {
      // Shortfall — fill from parts.unit_cost so the caller still gets a
      // plausible cost number. This isn't ideal but matches how legacy
      // last_cost behaved when stock went negative.
      const fallback = await this.getCurrentCostFallback(tenantId, partId);
      const blendedTotal = totalCost + remaining * fallback;
      unitCost = blendedTotal / qty;
    }
    return {
      unitCost: Math.round(unitCost * 10000) / 10000,
      method,
      layersConsumed,
      shortfall: Math.max(0, remaining),
    };
  }

  /**
   * Peek at the cost the next sale of `qty` units would draw, without
   * mutating the layers. Useful for pricing previews and reports.
   */
  async peekCost(
    tenantId: string,
    partId: string,
    qty: number,
    methodOverride?: string,
  ): Promise<{ unitCost: number; method: string }> {
    if (qty <= 0) return { unitCost: 0, method: 'noop' };
    const method = methodOverride ?? (await this.getCostMethod(tenantId, partId));
    const client = this.supabase.getClient();
    if (method === 'last_cost') {
      return {
        unitCost: await this.getCurrentCostFallback(tenantId, partId),
        method,
      };
    }
    if (method === 'weighted_average') {
      const { data: layers } = await client
        .from('parts_cost_layers')
        .select('unit_cost, quantity_remaining')
        .eq('tenant_id', tenantId)
        .eq('part_id', partId)
        .gt('quantity_remaining', 0);
      const rows = (layers ?? []) as Array<{ unit_cost: number; quantity_remaining: number }>;
      const totalQty = rows.reduce((s, l) => s + Number(l.quantity_remaining), 0);
      const wac = totalQty > 0
        ? rows.reduce((s, l) => s + Number(l.unit_cost) * Number(l.quantity_remaining), 0) / totalQty
        : await this.getCurrentCostFallback(tenantId, partId);
      return { unitCost: Math.round(wac * 10000) / 10000, method };
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
      const top = (data ?? [])[0];
      if (top) return { unitCost: Math.round(Number(top.unit_cost) * 10000) / 10000, method };
      return { unitCost: await this.getCurrentCostFallback(tenantId, partId), method };
    }
    const fifo = method !== 'lifo';
    const { data: layers } = await client
      .from('parts_cost_layers')
      .select('unit_cost, quantity_remaining, received_at')
      .eq('tenant_id', tenantId)
      .eq('part_id', partId)
      .gt('quantity_remaining', 0)
      .order('received_at', { ascending: fifo });
    const rows = (layers ?? []) as Array<{ unit_cost: number; quantity_remaining: number; received_at: string }>;
    let remaining = qty;
    let total = 0;
    let drawn = 0;
    for (const l of rows) {
      if (remaining <= 0) break;
      const take = Math.min(Number(l.quantity_remaining), remaining);
      total += take * Number(l.unit_cost);
      drawn += take;
      remaining -= take;
    }
    if (remaining > 0) {
      const fallback = await this.getCurrentCostFallback(tenantId, partId);
      total += remaining * fallback;
      drawn = qty;
    }
    return {
      unitCost: drawn > 0 ? Math.round((total / drawn) * 10000) / 10000 : 0,
      method,
    };
  }

  private async getCurrentCostFallback(tenantId: string, partId: string): Promise<number> {
    const { data: part } = await this.supabase
      .getClient()
      .from('parts')
      .select('unit_cost')
      .eq('id', partId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    return Number(part?.unit_cost ?? 0);
  }

  /**
   * Apply landed costs to a PO and recalculate part costs.
   */
  async applyLandedCosts(
    tenantId: string,
    poId: string,
    additionalCosts: Array<{ type: string; amount: number; allocation_method?: 'by_value' | 'by_quantity' }>,
  ) {
    const client = this.supabase.getClient();

    // Save additional costs on PO
    await client
      .from('purchase_orders')
      .update({ additional_costs: additionalCosts })
      .eq('id', poId)
      .eq('tenant_id', tenantId);

    // Get PO lines
    const { data: poLines } = await client
      .from('po_lines')
      .select('id, part_id, unit_cost, quantity, received_qty')
      .eq('purchase_order_id', poId)
      .eq('tenant_id', tenantId);

    if (!poLines || poLines.length === 0) return { updated: 0 };

    // Calculate landed costs
    const lineData = poLines.map((l) => ({
      unitCost: Number(l.unit_cost),
      quantity: Number(l.quantity),
    }));

    const landedCosts = this.distributeLandedCosts(lineData, additionalCosts);

    // Update each PO line with landed cost
    let updated = 0;
    for (let i = 0; i < poLines.length; i++) {
      const line = poLines[i]!;
      const landedUnitCost = landedCosts[i]!;

      await client
        .from('po_lines')
        .update({ landed_unit_cost: landedUnitCost })
        .eq('id', line.id)
        .eq('tenant_id', tenantId);

      // If goods already received, recalculate part cost
      if (line.part_id && Number(line.received_qty) > 0) {
        await this.recalculateCost(
          tenantId,
          line.part_id as string,
          Number(line.received_qty),
          Number(line.unit_cost),
          landedUnitCost,
        );
      }

      updated++;
    }

    return { updated, additionalCosts };
  }
}
