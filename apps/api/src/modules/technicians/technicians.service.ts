import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateTechnicianInput, UpdateTechnicianInput } from '@mecanix/validators';

@Injectable()
export class TechniciansService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('technicians')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('technicians')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Technician not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreateTechnicianInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('technicians')
      .insert({
        tenant_id: tenantId,
        full_name: input.fullName,
        phone: input.phone || null,
        specializations: input.specializations ?? [],
        hourly_rate: input.hourlyRate ?? null,
        cost_per_hour: input.costPerHour ?? null,
        is_active: input.isActive ?? true,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateTechnicianInput) {
    await this.getById(tenantId, id);

    const updateData: Record<string, unknown> = { updated_by: userId };
    if (input.fullName !== undefined) updateData['full_name'] = input.fullName;
    if (input.phone !== undefined) updateData['phone'] = input.phone || null;
    if (input.specializations !== undefined) updateData['specializations'] = input.specializations;
    if (input.hourlyRate !== undefined) updateData['hourly_rate'] = input.hourlyRate;
    if (input.costPerHour !== undefined) updateData['cost_per_hour'] = input.costPerHour;
    if (input.isActive !== undefined) updateData['is_active'] = input.isActive;

    const { data, error } = await this.supabase
      .getClient()
      .from('technicians')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(tenantId: string, id: string) {
    await this.getById(tenantId, id);

    const { error } = await this.supabase
      .getClient()
      .from('technicians')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { deleted: true };
  }

  /**
   * Single-pass snapshot for the live board.
   *
   * The old /floor page fired N parallel queries (one active-timer +
   * one clock-today per tech). That's fine with five techs, ugly with
   * twenty. This batches everything into four scoped queries:
   *   - active technicians
   *   - today's clock records
   *   - running/paused time_entries (with job + vehicle + bay joined)
   *   - today's labour_lines grouped by technician (for billed hours)
   * Then the per-tech shape is assembled in memory. Complexity stays
   * O(technicians).
   */
  async liveBoard(tenantId: string) {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: techs } = await client
      .from('technicians')
      .select('id, full_name, specializations, hourly_rate')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('full_name', { ascending: true });

    const { data: clocks } = await client
      .from('clock_records')
      .select('technician_id, clock_in, clock_out, total_minutes')
      .eq('tenant_id', tenantId)
      .eq('date', today);

    const { data: timers } = await client
      .from('time_entries')
      .select(
        'id, technician_id, started_at, paused_at, status, job_card_id, total_seconds, job:job_cards(id, job_number, bay_id, vehicle:vehicles(plate), bay:bays(id, name))',
      )
      .eq('tenant_id', tenantId)
      .in('status', ['running', 'paused']);

    const { data: todayLabour } = await client
      .from('labour_lines')
      .select('technician_id, hours, job_card_id')
      .eq('tenant_id', tenantId)
      .eq('line_status', 'charged')
      .not('technician_id', 'is', null)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    const billedByTech = new Map<string, { hours: number; jobs: Set<string> }>();
    for (const l of todayLabour ?? []) {
      const id = l.technician_id as string;
      if (!id) continue;
      const row = billedByTech.get(id) ?? { hours: 0, jobs: new Set<string>() };
      row.hours += Number(l.hours) || 0;
      if (l.job_card_id) row.jobs.add(l.job_card_id as string);
      billedByTech.set(id, row);
    }

    const clockByTech = new Map<string, Record<string, unknown>>();
    for (const c of clocks ?? []) {
      clockByTech.set(c.technician_id as string, c);
    }

    const timerByTech = new Map<string, Record<string, unknown>>();
    for (const t of timers ?? []) {
      // Only one running/paused per tech is expected, but just in case
      // a legacy duplicate exists, prefer the running one.
      const existing = timerByTech.get(t.technician_id as string);
      if (!existing || t.status === 'running') {
        timerByTech.set(t.technician_id as string, t);
      }
    }

    return (techs ?? []).map((tech) => {
      const clock = clockByTech.get(tech.id as string);
      const timer = timerByTech.get(tech.id as string);
      const billed = billedByTech.get(tech.id as string);

      const clockIn = (clock?.clock_in as string | undefined) ?? null;
      const clockOut = (clock?.clock_out as string | undefined) ?? null;
      const totalMinutes = (clock?.total_minutes as number | undefined) ?? null;
      const clockedNow = Boolean(clockIn && !clockOut);

      let todayClockedHours = 0;
      if (totalMinutes != null) {
        todayClockedHours = totalMinutes / 60;
      } else if (clockIn && clockedNow) {
        todayClockedHours = (Date.now() - new Date(clockIn).getTime()) / 3_600_000;
      }

      const job = timer?.job && typeof timer.job === 'object'
        ? (Array.isArray(timer.job) ? timer.job[0] : timer.job) as Record<string, unknown>
        : null;
      const vehicle = job?.vehicle && typeof job.vehicle === 'object'
        ? (Array.isArray(job.vehicle) ? job.vehicle[0] : job.vehicle) as Record<string, unknown>
        : null;
      const bay = job?.bay && typeof job.bay === 'object'
        ? (Array.isArray(job.bay) ? job.bay[0] : job.bay) as Record<string, unknown>
        : null;

      let status: 'working' | 'paused' | 'idle' | 'off' = 'off';
      if (timer?.status === 'running') status = 'working';
      else if (timer?.status === 'paused') status = 'paused';
      else if (clockedNow) status = 'idle';

      return {
        technician: {
          id: tech.id as string,
          full_name: tech.full_name as string,
          specializations: (tech.specializations as string[]) ?? [],
        },
        status,
        clocked_in: clockedNow,
        clock_in_at: clockIn,
        clock_out_at: clockOut,
        today_clocked_hours: Math.round(todayClockedHours * 100) / 100,
        today_billed_hours: billed ? Math.round(billed.hours * 100) / 100 : 0,
        today_jobs_count: billed ? billed.jobs.size : 0,
        active_timer: timer
          ? {
              id: timer.id as string,
              status: timer.status as string,
              started_at: timer.started_at as string,
              paused_at: (timer.paused_at as string | null) ?? null,
              total_seconds: Number(timer.total_seconds) || 0,
              job_card_id: timer.job_card_id as string,
              job_number: (job?.job_number as string | undefined) ?? null,
              vehicle_plate: (vehicle?.plate as string | undefined) ?? null,
              bay_id: (bay?.id as string | undefined) ?? null,
              bay_name: (bay?.name as string | undefined) ?? null,
            }
          : null,
      };
    });
  }
}
