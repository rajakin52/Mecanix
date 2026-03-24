import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateVehicleInput, UpdateVehicleInput, PaginationInput } from '@mecanix/validators';
import { sanitizeSearch } from '../../common/utils/sanitize';

@Injectable()
export class VehiclesService {
  constructor(private readonly supabase: SupabaseService) {}

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

    return {
      jobs: (jobs ?? []).map((j: Record<string, unknown>) => ({
        ...j,
        parts_lines: partsByJob[j.id as string] ?? [],
      })),
      parts_history: Object.values(partsHistory).sort(
        (a, b) => b.last_installed.localeCompare(a.last_installed),
      ),
      cost_summary: {
        total_spent: Math.round(totalSpent * 100) / 100,
        labour_total: Math.round(totalLabour * 100) / 100,
        parts_total: Math.round(totalParts * 100) / 100,
        job_count: (jobs ?? []).length,
        by_category: costByCategory,
      },
    };
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
}
