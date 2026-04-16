import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class BaysService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('bays')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order');

    if (error) throw error;
    return data ?? [];
  }

  async create(
    tenantId: string,
    input: { name: string; type?: string; sortOrder?: number },
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('bays')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        type: input.type ?? 'general',
        sort_order: input.sortOrder ?? 0,
        is_active: true,
      } as never)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(
    tenantId: string,
    id: string,
    input: { name?: string; type?: string; sortOrder?: number },
  ) {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.type !== undefined) updates.type = input.type;
    if (input.sortOrder !== undefined) updates.sort_order = input.sortOrder;

    const { data, error } = await this.supabase
      .getClient()
      .from('bays')
      .update(updates as never)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Bay not found');
    return data;
  }

  async delete(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('bays')
      .update({ is_active: false } as never)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new NotFoundException('Bay not found');
    return { deleted: true };
  }

  async getFloorView(tenantId: string) {
    const client = this.supabase.getClient();

    // Get all active bays
    const { data: bays, error: baysError } = await client
      .from('bays')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('sort_order');

    if (baysError) throw baysError;

    // Get active job cards assigned to bays (not yet invoiced)
    const { data: activeJobs, error: jobsError } = await client
      .from('job_cards')
      .select(
        'id, job_number, status, bay_id, technician_id, vehicle:vehicles(id, plate_number, make, model), technician:technicians(id, name), started_at',
      )
      .eq('tenant_id', tenantId)
      .not('bay_id', 'is', null)
      .not('status', 'eq', 'invoiced');

    if (jobsError) throw jobsError;

    // Map jobs to bays
    const jobsByBay = new Map<string, Record<string, unknown>>();
    for (const job of activeJobs ?? []) {
      if (job.bay_id) {
        const elapsed = job.started_at
          ? Math.round(
              (Date.now() - new Date(job.started_at as string).getTime()) /
                60000,
            )
          : null;

        jobsByBay.set(String(job.bay_id), {
          id: job.id,
          job_number: job.job_number,
          status: job.status,
          vehicle: job.vehicle,
          technician: job.technician,
          technician_id: job.technician_id,
          elapsed_minutes: elapsed,
        });
      }
    }

    return (bays ?? []).map((bay) => ({
      ...bay,
      current_job: jobsByBay.get(String(bay.id)) ?? null,
    }));
  }
}
