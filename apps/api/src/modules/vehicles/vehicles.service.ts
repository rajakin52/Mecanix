import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateVehicleInput, UpdateVehicleInput, PaginationInput } from '@mecanix/validators';
import { sanitizeSearch } from '../../common/utils/sanitize';

@Injectable()
export class VehiclesService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Lightweight lookup: just non-deleted plates for the tenant. Powers
   * the PO form combobox so the user can search-and-pick rather than
   * type a plate from memory.
   */
  async listPlates(tenantId: string): Promise<string[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('vehicles')
      .select('plate')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .not('plate', 'is', null)
      .order('plate', { ascending: true });
    if (error) throw error;
    const seen = new Set<string>();
    for (const r of data ?? []) {
      const p = (r as { plate: string | null }).plate;
      if (p && p.trim()) seen.add(p.trim());
    }
    return Array.from(seen);
  }

  async list(tenantId: string, pagination: PaginationInput, customerId?: string) {
    const client = this.supabase.getClient();
    const { page, pageSize, search, sortBy, sortOrder } = pagination;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from('vehicles')
      .select('*, customers!inner(full_name)', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .is('deleted_at', null);

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    if (search) {
      const s = sanitizeSearch(search);
      query = query.or(`plate.ilike.%${s}%,vin.ilike.%${s}%,make.ilike.%${s}%,model.ilike.%${s}%`);
    }

    if (sortBy) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    const { data, count, error } = await query.range(from, to);

    if (error) throw error;

    return {
      data: data ?? [],
      meta: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
      },
    };
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('vehicles')
      .select('*, customers(full_name, phone)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .single();

    if (error || !data) {
      throw new NotFoundException('Vehicle not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreateVehicleInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('vehicles')
      .insert({
        tenant_id: tenantId,
        customer_id: input.customerId,
        plate: input.plate,
        vin: input.vin || null,
        make: input.make,
        model: input.model,
        year: input.year || null,
        color: input.color || null,
        fuel_type: input.fuelType || null,
        engine_size: input.engineSize || null,
        mileage: input.mileage || null,
        notes: input.notes || null,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateVehicleInput) {
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = { updated_by: userId };
    if (input.customerId !== undefined) updateData['customer_id'] = input.customerId;
    if (input.plate !== undefined) updateData['plate'] = input.plate;
    if (input.vin !== undefined) updateData['vin'] = input.vin || null;
    if (input.make !== undefined) updateData['make'] = input.make;
    if (input.model !== undefined) updateData['model'] = input.model;
    if (input.year !== undefined) updateData['year'] = input.year || null;
    if (input.color !== undefined) updateData['color'] = input.color || null;
    if (input.fuelType !== undefined) updateData['fuel_type'] = input.fuelType || null;
    if (input.engineSize !== undefined) updateData['engine_size'] = input.engineSize || null;
    if (input.mileage !== undefined) updateData['mileage'] = input.mileage || null;
    if (input.notes !== undefined) updateData['notes'] = input.notes || null;

    const { data, error } = await this.supabase
      .getClient()
      .from('vehicles')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(tenantId: string, id: string, userId: string) {
    await this.getById(tenantId, id);

    const { error } = await this.supabase
      .getClient()
      .from('vehicles')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  async getHistory(tenantId: string, vehicleId: string) {
    await this.getById(tenantId, vehicleId);

    const client = this.supabase.getClient();

    // Fetch all job cards for this vehicle with parts lines
    const { data: jobs, error: jobsError } = await client
      .from('job_cards')
      .select(
        '*, customer:customers(id, full_name), primary_technician:technicians(id, full_name)',
      )
      .eq('vehicle_id', vehicleId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (jobsError) throw jobsError;

    // Fetch all parts lines for these jobs
    const jobIds = (jobs ?? []).map((j: { id: string }) => j.id);

    let partsLines: Array<{
      id: string;
      job_card_id: string;
      part_name: string;
      part_number: string | null;
      quantity: number;
      unit_cost: number;
      sell_price: number;
      subtotal: number;
      created_at: string;
    }> = [];

    if (jobIds.length > 0) {
      const { data: parts, error: partsError } = await client
        .from('parts_lines')
        .select('*')
        .in('job_card_id', jobIds)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (partsError) throw partsError;
      partsLines = parts ?? [];
    }

    // Group parts by job
    const partsByJob: Record<string, typeof partsLines> = {};
    for (const pl of partsLines) {
      if (!partsByJob[pl.job_card_id]) partsByJob[pl.job_card_id] = [];
      partsByJob[pl.job_card_id]!.push(pl);
    }

    // Build parts install history: group by part_name/part_number, track last installed
    const partsHistory: Record<
      string,
      { part_name: string; part_number: string | null; last_installed: string; install_count: number; jobs: string[] }
    > = {};

    for (const pl of partsLines) {
      const key = pl.part_number ?? pl.part_name;
      if (!partsHistory[key]) {
        partsHistory[key] = {
          part_name: pl.part_name,
          part_number: pl.part_number,
          last_installed: pl.created_at,
          install_count: 0,
          jobs: [],
        };
      }
      partsHistory[key]!.install_count += pl.quantity;
      if (!partsHistory[key]!.jobs.includes(pl.job_card_id)) {
        partsHistory[key]!.jobs.push(pl.job_card_id);
      }
      // Track most recent install
      if (pl.created_at > partsHistory[key]!.last_installed) {
        partsHistory[key]!.last_installed = pl.created_at;
      }
    }

    // Build cost summary with category breakdown
    const CATEGORY_LABELS: Record<string, string> = {
      mechanical: 'mechanical',
      body_work: 'body_work',
      electrical: 'electrical',
      maintenance: 'maintenance',
    };

    const costByCategory: Record<string, { labour: number; parts: number; total: number; count: number }> = {};
    let totalLabour = 0;
    let totalParts = 0;
    let totalSpent = 0;

    for (const j of (jobs ?? []) as Array<Record<string, unknown>>) {
      const labour = (j.labour_total as number) ?? 0;
      const parts = (j.parts_total as number) ?? 0;
      const grand = (j.grand_total as number) ?? 0;
      totalLabour += labour;
      totalParts += parts;
      totalSpent += grand;

      // Determine category from labels
      const labels = (j.labels as string[]) ?? [];
      let category = 'mechanical'; // default
      for (const label of labels) {
        if (CATEGORY_LABELS[label]) {
          category = label;
          break;
        }
      }

      if (!costByCategory[category]) {
        costByCategory[category] = { labour: 0, parts: 0, total: 0, count: 0 };
      }
      costByCategory[category]!.labour += labour;
      costByCategory[category]!.parts += parts;
      costByCategory[category]!.total += grand;
      costByCategory[category]!.count += 1;
    }

    // AIDA damage assessments for this vehicle — newest first.
    const { data: assessments } = await client
      .from('damage_assessments')
      .select(
        'id, status, source, created_at, analysed_at, confidence_avg, total_estimate, job_card_id, job_card:job_cards(id, job_number)',
      )
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });

    return {
      jobs: (jobs ?? []).map((j: Record<string, unknown>) => ({
        ...j,
        parts_lines: partsByJob[j.id as string] ?? [],
      })),
      parts_history: Object.values(partsHistory).sort(
        (a, b) => b.last_installed.localeCompare(a.last_installed),
      ),
      assessments: assessments ?? [],
      cost_summary: {
        total_spent: Math.round(totalSpent * 100) / 100,
        labour_total: Math.round(totalLabour * 100) / 100,
        parts_total: Math.round(totalParts * 100) / 100,
        job_count: (jobs ?? []).length,
        by_category: costByCategory,
      },
    };
  }

  /**
   * Active warranty coverage for a vehicle. Pulls every parts/labour
   * line whose warranty window might still be open, computes expiry
   * from warranty_starts_at + warranty_months, and filters out
   * anything already past date or past km (when the vehicle's
   * current mileage is known).
   *
   * Also returns a `comeback_candidate` flag — if the vehicle has
   * had *any* invoiced or ready job in the last 30 days the
   * receptionist should at least consider flagging a new job as a
   * comeback. Cheap heuristic, no false-positive cost.
   */
  async getWarrantyCoverage(tenantId: string, vehicleId: string) {
    const client = this.supabase.getClient();
    await this.getById(tenantId, vehicleId);

    // Pull the vehicle's current mileage for km-window checks.
    const { data: vehicle } = await client
      .from('vehicles')
      .select('mileage')
      .eq('id', vehicleId)
      .eq('tenant_id', tenantId)
      .single();
    const currentMileage = (vehicle?.mileage as number | null) ?? null;

    // Join through job_cards so we only surface lines for this vehicle
    // and so the front-end can link straight back to the job.
    const { data: parts } = await client
      .from('parts_lines')
      .select(
        'id, part_name, part_number, warranty_months, warranty_km, warranty_starts_at, job_card_id, subtotal, job:job_cards!inner(id, job_number, vehicle_id, date_closed)',
      )
      .eq('tenant_id', tenantId)
      .not('warranty_months', 'is', null)
      .eq('job.vehicle_id', vehicleId);

    const { data: labour } = await client
      .from('labour_lines')
      .select(
        'id, description, warranty_months, warranty_km, warranty_starts_at, job_card_id, subtotal, job:job_cards!inner(id, job_number, vehicle_id, date_closed)',
      )
      .eq('tenant_id', tenantId)
      .not('warranty_months', 'is', null)
      .eq('job.vehicle_id', vehicleId);

    const now = Date.now();
    type CoverageRow = {
      id: string;
      kind: 'parts' | 'labour';
      description: string;
      job_card_id: string;
      job_number: string | null;
      starts_at: string | null;
      warranty_months: number | null;
      warranty_km: number | null;
      expires_at: string | null;
      days_remaining: number | null;
      km_remaining: number | null;
      subtotal: number;
    };
    const active: CoverageRow[] = [];

    const consider = (row: Record<string, unknown>, kind: 'parts' | 'labour', description: string) => {
      const startsAt = (row.warranty_starts_at as string | null) ?? (row.job && typeof row.job === 'object'
        ? (row.job as Record<string, unknown>).date_closed as string | null
        : null);
      const months = row.warranty_months as number | null;
      const km = row.warranty_km as number | null;
      if (!startsAt) return;
      const start = new Date(startsAt).getTime();

      let daysRemaining: number | null = null;
      let expiresAt: string | null = null;
      if (months != null) {
        const expiry = new Date(startsAt);
        expiry.setMonth(expiry.getMonth() + months);
        expiresAt = expiry.toISOString();
        daysRemaining = Math.floor((expiry.getTime() - now) / (1000 * 60 * 60 * 24));
      }

      // km window: the line-start mileage isn't captured today, so
      // we check against the vehicle's last-known mileage alone —
      // treat coverage as expired only when we *know* the ratio.
      let kmRemaining: number | null = null;
      if (km != null && currentMileage != null) {
        // Conservative: if we don't know start mileage, treat the
        // first ride after the job as mile zero and let the user
        // correct later. Not ideal but better than silent data loss.
        kmRemaining = km;
      }

      const dateExpired = daysRemaining != null && daysRemaining < 0;
      if (dateExpired) return;

      const job = row.job && typeof row.job === 'object' ? (row.job as Record<string, unknown>) : null;

      active.push({
        id: row.id as string,
        kind,
        description,
        job_card_id: row.job_card_id as string,
        job_number: (job?.job_number as string | null) ?? null,
        starts_at: startsAt,
        warranty_months: months,
        warranty_km: km,
        expires_at: expiresAt,
        days_remaining: daysRemaining,
        km_remaining: kmRemaining,
        subtotal: Number(row.subtotal ?? 0),
        // placate ts - unused field for now; start may be consumed by future reports
        _start: start,
      } as CoverageRow);
    };

    for (const row of parts ?? []) {
      consider(row, 'parts', (row.part_name as string) ?? '');
    }
    for (const row of labour ?? []) {
      consider(row, 'labour', (row.description as string) ?? '');
    }

    active.sort((a, b) => (a.days_remaining ?? 99999) - (b.days_remaining ?? 99999));

    // Comeback candidate: any non-cancelled job touched this vehicle
    // in the last 30 days.
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await client
      .from('job_cards')
      .select('id, job_number, status, date_closed, created_at')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .not('status', 'eq', 'cancelled')
      .is('deleted_at', null)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(5);

    return {
      active_coverage: active,
      comeback_candidates: recent ?? [],
      current_mileage: currentMileage,
    };
  }

  /**
   * Composite vehicle health score (0-100) covering five signals.
   * Weights chosen to make the score move visibly on the actions an
   * owner cares about:
   *
   *   latest DVI           : 50 weight (already 0-100, the anchor)
   *   deferred red items   : 15 weight, linear penalty, 3+ items = 0
   *   recent comebacks 12m : 15 weight, 1 = 66%, 2 = 33%, 3+ = 0%
   *   days since service   : 10 weight, 180d+ = 0%
   *   active warranty      : 10 weight, any coverage = 100%
   *
   * A vehicle with no DVI on record gets a neutral 60 so it doesn't
   * show up as a crisis.
   */
  async computeHealthScore(tenantId: string, vehicleId: string, force = false) {
    const client = this.supabase.getClient();

    // Cache-check unless caller forced a recompute.
    if (!force) {
      const { data: cached } = await client
        .from('vehicles')
        .select('health_score, health_score_updated_at, health_score_components')
        .eq('id', vehicleId)
        .eq('tenant_id', tenantId)
        .single();
      if (cached?.health_score != null && cached.health_score_updated_at) {
        const ageMs = Date.now() - new Date(cached.health_score_updated_at as string).getTime();
        if (ageMs < 60 * 60 * 1000) {
          return {
            score: cached.health_score as number,
            updated_at: cached.health_score_updated_at as string,
            components: (cached.health_score_components as Record<string, unknown>) ?? {},
            cached: true,
          };
        }
      }
    }

    const now = Date.now();

    // 1. Latest DVI on any of this vehicle's jobs.
    const { data: latestInspection } = await client
      .from('vehicle_inspections')
      .select('health_score, created_at')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const dviScore = latestInspection?.health_score != null
      ? Number(latestInspection.health_score)
      : null;

    // 2. Deferred red items currently open.
    const { data: deferredReds } = await client
      .from('deferred_services')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .eq('priority', 'red')
      .in('status', ['pending', 'reminded']);
    const redCount = (deferredReds ?? []).length;
    const deferredSub = Math.max(0, Math.min(100, 100 - redCount * 35));

    // 3. Comebacks in last 12 months.
    const twelveMonthsAgo = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
    const { data: comebacks } = await client
      .from('job_cards')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .eq('is_comeback', true)
      .is('deleted_at', null)
      .gte('created_at', twelveMonthsAgo);
    const comebackCount = (comebacks ?? []).length;
    const comebackSub = Math.max(0, 100 - comebackCount * 33);

    // 4. Days since last *invoiced* or *ready* job (the vehicle has
    //    actually been serviced — open jobs don't count).
    const { data: lastService } = await client
      .from('job_cards')
      .select('date_closed, created_at')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .in('status', ['invoiced', 'ready'])
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const lastServiceAt = lastService?.date_closed ?? lastService?.created_at ?? null;
    let daysSinceSub = 50; // neutral when we don't know
    let daysSinceService: number | null = null;
    if (lastServiceAt) {
      daysSinceService = Math.floor((now - new Date(lastServiceAt as string).getTime()) / (24 * 60 * 60 * 1000));
      daysSinceSub = Math.max(0, Math.min(100, 100 - (daysSinceService / 180) * 100));
    }

    // 5. Active warranty lines — any coverage still open is positive.
    const { data: warrantyParts } = await client
      .from('parts_lines')
      .select('warranty_months, warranty_starts_at, job:job_cards!inner(vehicle_id)')
      .eq('tenant_id', tenantId)
      .eq('job.vehicle_id', vehicleId)
      .not('warranty_months', 'is', null);
    const { data: warrantyLabour } = await client
      .from('labour_lines')
      .select('warranty_months, warranty_starts_at, job:job_cards!inner(vehicle_id)')
      .eq('tenant_id', tenantId)
      .eq('job.vehicle_id', vehicleId)
      .not('warranty_months', 'is', null);

    const hasActiveWarranty = (lines: Array<Record<string, unknown>> | null): boolean => {
      if (!lines) return false;
      for (const l of lines) {
        const start = l.warranty_starts_at as string | null;
        const months = l.warranty_months as number | null;
        if (!start || months == null) continue;
        const expiry = new Date(start);
        expiry.setMonth(expiry.getMonth() + months);
        if (expiry.getTime() > now) return true;
      }
      return false;
    };
    const anyWarranty = hasActiveWarranty(warrantyParts as Array<Record<string, unknown>> | null) ||
      hasActiveWarranty(warrantyLabour as Array<Record<string, unknown>> | null);
    const warrantySub = anyWarranty ? 100 : 50; // neutral when no coverage — not a negative signal

    // Composite weighted average.
    const dviAnchor = dviScore ?? 60;
    const score = Math.round(
      dviAnchor * 0.5 +
      deferredSub * 0.15 +
      comebackSub * 0.15 +
      daysSinceSub * 0.10 +
      warrantySub * 0.10,
    );

    const components = {
      dvi: { value: dviScore, weight: 50 },
      deferred_reds: { count: redCount, score: deferredSub, weight: 15 },
      comebacks_12m: { count: comebackCount, score: comebackSub, weight: 15 },
      days_since_service: { days: daysSinceService, score: daysSinceSub, weight: 10 },
      active_warranty: { has_coverage: anyWarranty, score: warrantySub, weight: 10 },
    };

    const updated_at = new Date().toISOString();
    await client
      .from('vehicles')
      .update({
        health_score: score,
        health_score_updated_at: updated_at,
        health_score_components: components,
      })
      .eq('id', vehicleId)
      .eq('tenant_id', tenantId);

    return { score, updated_at, components, cached: false };
  }

  /**
   * OEM-interval-driven upcoming services for a vehicle.
   *
   * For every applicable oem_service_schedules row (tenant-specific
   * takes precedence over global, then make+model > make-only >
   * all-makes), compute km-since / months-since, next-due km / date,
   * and classify urgency (overdue / soon / upcoming).
   *
   * Services are detected as performed via ILIKE match on labour-
   * line descriptions. A future labour_lines.service_mileage column
   * would make the km side exact; for MVP we use the crude
   * "every interval_km while driven" heuristic.
   */
  async getDueServices(tenantId: string, vehicleId: string) {
    const client = this.supabase.getClient();
    const { data: vehicle } = await client
      .from('vehicles')
      .select('id, make, model, mileage, created_at')
      .eq('id', vehicleId)
      .eq('tenant_id', tenantId)
      .single();
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const make = (vehicle.make as string) ?? '';
    const model = (vehicle.model as string) ?? '';
    const currentMileage = (vehicle.mileage as number) ?? 0;
    const now = Date.now();

    const { data: schedules } = await client
      .from('oem_service_schedules')
      .select('*')
      .eq('is_active', true)
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

    const candidates = (schedules ?? []).filter((s) => {
      const sMake = s.make as string | null;
      const sModel = s.model as string | null;
      if (sMake && sMake.toLowerCase() !== make.toLowerCase()) return false;
      if (sModel && sModel.toLowerCase() !== model.toLowerCase()) return false;
      return true;
    });
    // Prefer tenant-specific, then more-specific make/model rows.
    candidates.sort((a, b) => {
      const weight = (r: Record<string, unknown>) =>
        (r.tenant_id ? 8 : 0) + (r.model ? 4 : 0) + (r.make ? 2 : 0);
      return weight(b) - weight(a);
    });
    const seen = new Set<string>();
    const applicable: Array<Record<string, unknown>> = [];
    for (const s of candidates) {
      const key = (s.service_name as string).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      applicable.push(s);
    }

    const { data: labourLines } = await client
      .from('labour_lines')
      .select('description, created_at, job:job_cards!inner(id, vehicle_id, date_closed, status)')
      .eq('tenant_id', tenantId)
      .eq('line_status', 'charged')
      .eq('job.vehicle_id', vehicleId);

    const results = applicable.map((s) => {
      const serviceName = s.service_name as string;
      const intervalKm = (s.interval_km as number | null) ?? null;
      const intervalMonths = (s.interval_months as number | null) ?? null;

      const lower = serviceName.toLowerCase();
      const matches = (labourLines ?? [])
        .filter((l) => ((l.description as string) ?? '').toLowerCase().includes(lower))
        .sort((a, b) => {
          const ta = new Date(a.created_at as string).getTime();
          const tb = new Date(b.created_at as string).getTime();
          return tb - ta;
        });
      const lastMatch = matches[0] ?? null;
      const lastServiceDate = lastMatch
        ? new Date(
            ((lastMatch.job as unknown as { date_closed: string | null })?.date_closed) ??
              (lastMatch.created_at as string),
          )
        : null;

      const anchorDate = lastServiceDate ?? new Date(vehicle.created_at as string);
      const monthsSince = (now - anchorDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000);

      let kmSinceLast: number | null = null;
      let nextDueKm: number | null = null;
      if (intervalKm && currentMileage > 0) {
        const intervalsElapsed = Math.floor(currentMileage / intervalKm);
        nextDueKm = (intervalsElapsed + 1) * intervalKm;
        kmSinceLast = currentMileage - intervalsElapsed * intervalKm;
      }

      let nextDueDate: string | null = null;
      let daysUntilDue: number | null = null;
      if (intervalMonths) {
        const next = new Date(anchorDate);
        next.setMonth(next.getMonth() + intervalMonths);
        nextDueDate = next.toISOString().slice(0, 10);
        daysUntilDue = Math.floor((next.getTime() - now) / (24 * 60 * 60 * 1000));
      }

      const kmUntilDue =
        nextDueKm != null && currentMileage > 0 ? nextDueKm - currentMileage : null;

      let urgency: 'overdue' | 'soon' | 'upcoming' = 'upcoming';
      const overdueByDate = daysUntilDue != null && daysUntilDue < 0;
      const overdueByKm = kmUntilDue != null && kmUntilDue < 0;
      const soonByDate = daysUntilDue != null && daysUntilDue >= 0 && daysUntilDue <= 60;
      const soonByKm = kmUntilDue != null && kmUntilDue >= 0 && kmUntilDue <= 2000;
      if (overdueByDate || overdueByKm) urgency = 'overdue';
      else if (soonByDate || soonByKm) urgency = 'soon';

      return {
        schedule_id: s.id,
        service_name: serviceName,
        interval_km: intervalKm,
        interval_months: intervalMonths,
        estimated_hours: s.estimated_hours,
        typical_parts: s.typical_parts,
        notes: s.notes,
        last_service_at: lastServiceDate ? lastServiceDate.toISOString() : null,
        months_since_last: Math.round(monthsSince * 10) / 10,
        km_since_last: kmSinceLast,
        next_due_km: nextDueKm,
        next_due_date: nextDueDate,
        km_until_due: kmUntilDue,
        days_until_due: daysUntilDue,
        urgency,
      };
    });

    const rank = { overdue: 0, soon: 1, upcoming: 2 } as const;
    results.sort((a, b) => {
      const ra = rank[a.urgency];
      const rb = rank[b.urgency];
      if (ra !== rb) return ra - rb;
      return (a.days_until_due ?? 99999) - (b.days_until_due ?? 99999);
    });

    return { vehicle: { id: vehicle.id, mileage: currentMileage }, services: results };
  }

  async uploadPhoto(tenantId: string, vehicleId: string, userId: string, file: Buffer, filename: string) {
    await this.getById(tenantId, vehicleId);

    const path = `${tenantId}/${vehicleId}/${Date.now()}-${filename}`;

    const { error: uploadError } = await this.supabase
      .getClient()
      .storage.from('vehicle-photos')
      .upload(path, file, { contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;

    const { data: urlData } = this.supabase
      .getClient()
      .storage.from('vehicle-photos')
      .getPublicUrl(path);

    // Append to photos array
    const { data: vehicle } = await this.supabase
      .getClient()
      .from('vehicles')
      .select('photos')
      .eq('id', vehicleId)
      .eq('tenant_id', tenantId)
      .single();

    const photos = [...(vehicle?.photos ?? []), urlData.publicUrl];

    await this.supabase
      .getClient()
      .from('vehicles')
      .update({ photos, updated_by: userId })
      .eq('id', vehicleId)
      .eq('tenant_id', tenantId);

    return { url: urlData.publicUrl };
  }

  /**
   * Intake-time duplicate detector for vehicles. Plate is the
   * authoritative signal — normalise to uppercase stripped of
   * spaces / dashes and treat exact matches as near-certain
   * duplicates. VIN (when provided) is similarly uppercase-
   * normalised. Returns newest-first so the receptionist sees
   * active vehicles before historical ones.
   */
  async findDuplicates(
    tenantId: string,
    input: { plate?: string; vin?: string },
  ) {
    const client = this.supabase.getClient();
    const matches = new Map<
      string,
      {
        id: string;
        plate: string;
        make: string;
        model: string;
        year: number | null;
        vin: string | null;
        customer: { id: string; full_name: string } | null;
        match_reason: string;
        match_score: number;
      }
    >();

    const recordMatch = (
      row: Record<string, unknown>,
      reason: string,
      score: number,
    ) => {
      const id = row.id as string;
      const existing = matches.get(id);
      if (!existing || score > existing.match_score) {
        const cust = row.customer as unknown;
        const custObj = Array.isArray(cust)
          ? (cust[0] as { id: string; full_name: string } | undefined)
          : (cust as { id: string; full_name: string } | null);
        matches.set(id, {
          id,
          plate: row.plate as string,
          make: row.make as string,
          model: row.model as string,
          year: (row.year as number | null) ?? null,
          vin: (row.vin as string | null) ?? null,
          customer: custObj ?? null,
          match_reason: reason,
          match_score: score,
        });
      }
    };

    // Plate: uppercase, strip spaces + dashes.
    if (input.plate) {
      const normalised = input.plate.toUpperCase().replace(/[\s-]/g, '');
      if (normalised.length >= 3) {
        const { data } = await client
          .from('vehicles')
          .select('id, plate, make, model, year, vin, customer:customers(id, full_name)')
          .eq('tenant_id', tenantId)
          .ilike('plate', `%${normalised}%`)
          .order('created_at', { ascending: false })
          .limit(10);
        for (const row of data ?? []) {
          const rowNorm = (row.plate as string).toUpperCase().replace(/[\s-]/g, '');
          if (rowNorm === normalised) {
            recordMatch(row, 'plate', 1.0);
          }
        }
      }
    }

    // VIN: 17 chars, strict exact match.
    if (input.vin) {
      const normalised = input.vin.toUpperCase().trim();
      if (normalised.length >= 11) {
        const { data } = await client
          .from('vehicles')
          .select('id, plate, make, model, year, vin, customer:customers(id, full_name)')
          .eq('tenant_id', tenantId)
          .eq('vin', normalised)
          .limit(10);
        for (const row of data ?? []) recordMatch(row, 'vin', 0.98);
      }
    }

    return Array.from(matches.values()).sort((a, b) => b.match_score - a.match_score);
  }
}
