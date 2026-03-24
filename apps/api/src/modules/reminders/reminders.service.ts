import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateReminderInput, UpdateReminderInput } from '@mecanix/validators';

@Injectable()
export class RemindersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, vehicleId?: string, status?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('service_reminders')
      .select('*, vehicles(plate, make, model), customers(full_name, phone)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ?? [];
  }

  async create(tenantId: string, userId: string, input: CreateReminderInput) {
    const { data, error } = await this.supabase
      .getClient()
      .from('service_reminders')
      .insert({
        tenant_id: tenantId,
        vehicle_id: input.vehicleId,
        customer_id: input.customerId,
        reminder_type: input.reminderType,
        service_name: input.serviceName,
        next_mileage: input.nextMileage ?? null,
        mileage_interval: input.mileageInterval ?? null,
        next_date: input.nextDate ?? null,
        date_interval_days: input.dateIntervalDays ?? null,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select('*, vehicles(plate, make, model), customers(full_name, phone)')
      .single();

    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, input: UpdateReminderInput) {
    const existing = await this.getById(tenantId, id);
    if (!existing) throw new NotFoundException('Reminder not found');

    const updateData: Record<string, unknown> = {};
    if (input.reminderType !== undefined) updateData['reminder_type'] = input.reminderType;
    if (input.serviceName !== undefined) updateData['service_name'] = input.serviceName;
    if (input.nextMileage !== undefined) updateData['next_mileage'] = input.nextMileage;
    if (input.mileageInterval !== undefined) updateData['mileage_interval'] = input.mileageInterval;
    if (input.nextDate !== undefined) updateData['next_date'] = input.nextDate;
    if (input.dateIntervalDays !== undefined) updateData['date_interval_days'] = input.dateIntervalDays;
    if (input.notes !== undefined) updateData['notes'] = input.notes;

    const { data, error } = await this.supabase
      .getClient()
      .from('service_reminders')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*, vehicles(plate, make, model), customers(full_name, phone)')
      .single();

    if (error) throw error;
    return data;
  }

  async getDueReminders(tenantId: string) {
    const client = this.supabase.getClient();
    const today = new Date().toISOString().split('T')[0];

    // Get date-based due reminders
    const { data: dateReminders, error: dateError } = await client
      .from('service_reminders')
      .select('*, vehicles(plate, make, model, mileage), customers(full_name, phone)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('reminder_type', ['date', 'both'])
      .lte('next_date', today);

    if (dateError) throw dateError;

    // Get all active mileage-based reminders (we need to compare with vehicle mileage)
    const { data: mileageReminders, error: mileageError } = await client
      .from('service_reminders')
      .select('*, vehicles(plate, make, model, mileage), customers(full_name, phone)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .in('reminder_type', ['mileage', 'both']);

    if (mileageError) throw mileageError;

    // Filter mileage reminders where vehicle mileage >= next_mileage
    const dueMileage = (mileageReminders ?? []).filter((r: Record<string, unknown>) => {
      const vehicle = r.vehicles as Record<string, unknown> | null;
      const vehicleMileage = vehicle?.mileage as number | null;
      const nextMileage = r.next_mileage as number | null;
      if (vehicleMileage == null || nextMileage == null) return false;
      return vehicleMileage >= nextMileage;
    });

    // Combine and deduplicate
    const allDue = [...(dateReminders ?? [])];
    const dateIds = new Set(allDue.map((r: Record<string, unknown>) => r.id as string));
    for (const r of dueMileage) {
      if (!dateIds.has(r.id as string)) {
        allDue.push(r);
      }
    }

    return allDue;
  }

  async markAsSent(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('service_reminders')
      .update({
        status: 'sent',
        last_sent_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async markAsCompleted(tenantId: string, id: string) {
    const existing = await this.getById(tenantId, id);
    if (!existing) throw new NotFoundException('Reminder not found');

    const e = existing as Record<string, unknown>;
    const updateData: Record<string, unknown> = { status: 'completed' };

    // If recurring, reset next_date/next_mileage and set status back to active
    const hasDateInterval = (e.date_interval_days as number | null) != null && (e.date_interval_days as number) > 0;
    const hasMileageInterval = (e.mileage_interval as number | null) != null && (e.mileage_interval as number) > 0;

    if (hasDateInterval || hasMileageInterval) {
      updateData['status'] = 'active';
      updateData['last_sent_at'] = null;

      if (hasDateInterval && e.next_date) {
        const nextDate = new Date(e.next_date as string);
        nextDate.setDate(nextDate.getDate() + (e.date_interval_days as number));
        updateData['next_date'] = nextDate.toISOString().split('T')[0];
      }

      if (hasMileageInterval && e.next_mileage != null) {
        updateData['next_mileage'] = (e.next_mileage as number) + (e.mileage_interval as number);
      }
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('service_reminders')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('*, vehicles(plate, make, model), customers(full_name, phone)')
      .single();

    if (error) throw error;
    return data;
  }

  async getByVehicle(tenantId: string, vehicleId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('service_reminders')
      .select('*, vehicles(plate, make, model), customers(full_name, phone)')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  private async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('service_reminders')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Reminder not found');
    }

    return data;
  }
}
