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
    // Placeholder — will return job cards / service records when that module exists
    await this.getById(tenantId, vehicleId);
    return [];
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
