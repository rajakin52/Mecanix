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
   * Distribute additional costs (freight, customs, etc.) across PO lines proportionally.
   */
  distributeLandedCosts(
    lines: Array<{ unitCost: number; quantity: number }>,
    additionalCosts: Array<{ type: string; amount: number }>,
  ): number[] {
    const totalAdditional = additionalCosts.reduce((sum, c) => sum + c.amount, 0);
    if (totalAdditional <= 0) return lines.map((l) => l.unitCost);

    const totalPOValue = lines.reduce((sum, l) => sum + l.unitCost * l.quantity, 0);
    if (totalPOValue <= 0) return lines.map((l) => l.unitCost);

    return lines.map((line) => {
      const lineValue = line.unitCost * line.quantity;
      const proportion = lineValue / totalPOValue;
      const additionalPerUnit = (totalAdditional * proportion) / line.quantity;
      return Math.round((line.unitCost + additionalPerUnit) * 100) / 100;
    });
  }

  /**
   * Apply landed costs to a PO and recalculate part costs.
   */
  async applyLandedCosts(
    tenantId: string,
    poId: string,
    additionalCosts: Array<{ type: string; amount: number }>,
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
