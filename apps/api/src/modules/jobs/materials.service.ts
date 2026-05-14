import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { JobsService } from './jobs.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type MaterialsChargeType = 'refinish' | 'body' | 'shop_supplies';
export type MaterialsRateSource = 'customer' | 'insurance' | 'tenant' | 'none';

export interface MaterialsChargeLine {
  type: MaterialsChargeType;
  description: string;
  hours_basis: number;
  rate: number;
  rate_source: MaterialsRateSource;
  subtotal: number;
}

export interface MaterialsPreview {
  job_card_id: string;
  job_number: string | null;
  labour_totals: {
    mechanical: number;
    body: number;
    refinish: number;
    detail: number;
  };
  mechanical_labour_value: number;
  rates_applied: {
    materials_rate_refinish: number | null;
    materials_rate_body: number | null;
    shop_supplies_pct: number | null;
    shop_supplies_cap: number | null;
  };
  charges: MaterialsChargeLine[];
  total: number;
}

interface RateBundle {
  materials_rate_refinish: number | null;
  materials_rate_body: number | null;
  shop_supplies_pct: number | null;
  shop_supplies_cap: number | null;
}

/**
 * MaterialsService — computes body-shop materials-recovery charges from
 * labour totals × rates. Rate cascade:
 *   customer override  →  insurance override  →  tenant default  →  none
 *
 * `apply` materialises the preview as parts_lines flagged
 * is_materials_recovery=true. Re-applying is idempotent (removes the
 * previous materials-recovery lines first).
 */
@Injectable()
export class MaterialsService {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
  ) {}

  async preview(tenantId: string, jobCardId: string): Promise<MaterialsPreview> {
    const client = this.supabase.getClient();

    // Job + customer + insurance — single query
    const { data: job, error: jobErr } = await client
      .from('job_cards')
      .select(
        'id, job_number, customer_id, insurance_company_id, customer:customers(materials_rate_refinish, materials_rate_body, shop_supplies_pct, shop_supplies_cap), insurance_company:insurance_companies(materials_rate_refinish, materials_rate_body, shop_supplies_pct, shop_supplies_cap)',
      )
      .eq('id', jobCardId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) throw new NotFoundException('Job card not found');

    const { data: tenant } = await client
      .from('tenants')
      .select('settings')
      .eq('id', tenantId)
      .maybeSingle();

    const pickOne = <T>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? v[0] ?? null : v ?? null;
    const customer = pickOne(job.customer as RateBundle | RateBundle[] | null);
    const insurance = pickOne(job.insurance_company as RateBundle | RateBundle[] | null);
    const settings = (tenant?.settings ?? {}) as Record<string, unknown>;

    const tenantDefaults: RateBundle = {
      materials_rate_refinish: numberOrNull(settings.materials_rate_refinish),
      materials_rate_body: numberOrNull(settings.materials_rate_body),
      shop_supplies_pct: numberOrNull(settings.shop_supplies_pct),
      shop_supplies_cap: numberOrNull(settings.shop_supplies_cap),
    };

    const resolve = (
      key: keyof RateBundle,
    ): { value: number | null; source: MaterialsRateSource } => {
      const c = customer ? customer[key] : null;
      if (c != null) return { value: Number(c), source: 'customer' };
      const i = insurance ? insurance[key] : null;
      if (i != null) return { value: Number(i), source: 'insurance' };
      const t = tenantDefaults[key];
      if (t != null) return { value: Number(t), source: 'tenant' };
      return { value: null, source: 'none' };
    };

    const refinishRate = resolve('materials_rate_refinish');
    const bodyRate = resolve('materials_rate_body');
    const suppliesPct = resolve('shop_supplies_pct');
    const suppliesCap = resolve('shop_supplies_cap');

    // Labour totals by type
    const { data: labour } = await client
      .from('labour_lines')
      .select('hours, rate, subtotal, labour_type')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId);

    type LRow = { hours: number; rate: number; subtotal: number; labour_type: string };
    const labourTotals = { mechanical: 0, body: 0, refinish: 0, detail: 0 };
    let mechanicalLabourValue = 0;
    for (const r of (labour ?? []) as LRow[]) {
      const hours = Number(r.hours ?? 0);
      const sub = Number(r.subtotal ?? 0);
      const t = (r.labour_type ?? 'mechanical') as keyof typeof labourTotals;
      if (t in labourTotals) labourTotals[t] += hours;
      if (t === 'mechanical' || t === 'detail') mechanicalLabourValue += sub;
    }

    const charges: MaterialsChargeLine[] = [];

    if (refinishRate.value != null && labourTotals.refinish > 0) {
      charges.push({
        type: 'refinish',
        description: `Refinish materials @ ${labourTotals.refinish.toFixed(2)} hrs × ${refinishRate.value.toFixed(2)}`,
        hours_basis: round2(labourTotals.refinish),
        rate: refinishRate.value,
        rate_source: refinishRate.source,
        subtotal: round2(labourTotals.refinish * refinishRate.value),
      });
    }
    if (bodyRate.value != null && labourTotals.body > 0) {
      charges.push({
        type: 'body',
        description: `Body materials @ ${labourTotals.body.toFixed(2)} hrs × ${bodyRate.value.toFixed(2)}`,
        hours_basis: round2(labourTotals.body),
        rate: bodyRate.value,
        rate_source: bodyRate.source,
        subtotal: round2(labourTotals.body * bodyRate.value),
      });
    }
    if (suppliesPct.value != null && mechanicalLabourValue > 0) {
      let value = mechanicalLabourValue * suppliesPct.value;
      if (suppliesCap.value != null && value > suppliesCap.value) value = suppliesCap.value;
      charges.push({
        type: 'shop_supplies',
        description: `Shop supplies @ ${(suppliesPct.value * 100).toFixed(1)}% of mechanical labour`,
        hours_basis: 0,
        rate: suppliesPct.value,
        rate_source: suppliesPct.source,
        subtotal: round2(value),
      });
    }

    const total = charges.reduce((s, c) => s + c.subtotal, 0);

    return {
      job_card_id: job.id as string,
      job_number: (job.job_number as string | null) ?? null,
      labour_totals: {
        mechanical: round2(labourTotals.mechanical),
        body: round2(labourTotals.body),
        refinish: round2(labourTotals.refinish),
        detail: round2(labourTotals.detail),
      },
      mechanical_labour_value: round2(mechanicalLabourValue),
      rates_applied: {
        materials_rate_refinish: refinishRate.value,
        materials_rate_body: bodyRate.value,
        shop_supplies_pct: suppliesPct.value,
        shop_supplies_cap: suppliesCap.value,
      },
      charges,
      total: round2(total),
    };
  }

  /**
   * Idempotent: removes existing materials-recovery lines for the job
   * and inserts a fresh set from the current preview.
   */
  async apply(tenantId: string, jobCardId: string, userId: string) {
    // Closed-card gate
    await this.jobsService.assertNotInvoiced(tenantId, jobCardId);
    const preview = await this.preview(tenantId, jobCardId);
    const client = this.supabase.getClient();

    const { error: delErr } = await client
      .from('parts_lines')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .eq('is_materials_recovery', true);
    if (delErr) throw delErr;

    if (preview.charges.length === 0) {
      return { applied: 0, total: 0, charges: [] };
    }

    const toInsert = preview.charges.map((c) => ({
      tenant_id: tenantId,
      job_card_id: jobCardId,
      part_name: c.description,
      part_number: null,
      quantity: 1,
      unit_cost: 0,
      sell_price: c.subtotal,
      markup_pct: 0,
      subtotal: c.subtotal,
      stock_status: 'issued',
      issued_at: new Date().toISOString(),
      is_materials_recovery: true,
    }));

    const { error: insErr } = await client.from('parts_lines').insert(toInsert);
    if (insErr) throw insErr;

    return { applied: preview.charges.length, total: preview.total, charges: preview.charges, userId };
  }
}

function numberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
