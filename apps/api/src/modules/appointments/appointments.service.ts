import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateAppointmentInput, UpdateAppointmentInput } from '@mecanix/validators';

const RESCHEDULE_TTL_DAYS = 90; // token lives 90 days past appointment date

interface AppointmentFilters {
  date?: string;
  status?: string;
  technicianId?: string;
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(tenantId: string, filters: AppointmentFilters) {
    const client = this.supabase.getClient();

    let query = client
      .from('appointments')
      .select(
        '*, customer:customers(id, full_name), vehicle:vehicles(id, plate, make, model), technician:technicians(id, full_name)',
      )
      .eq('tenant_id', tenantId);

    if (filters.date) {
      query = query.eq('scheduled_date', filters.date);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.technicianId) {
      query = query.eq('technician_id', filters.technicianId);
    }

    query = query.order('scheduled_date', { ascending: true }).order('scheduled_time', { ascending: true });

    const { data, error } = await query;

    if (error) throw error;

    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('appointments')
      .select(
        '*, customer:customers(id, full_name, phone), vehicle:vehicles(id, plate, make, model), technician:technicians(id, full_name)',
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Appointment not found');
    }

    return data;
  }

  async create(tenantId: string, userId: string, input: CreateAppointmentInput) {
    const client = this.supabase.getClient();

    let customerName = input.customerName ?? null;
    let customerPhone = input.customerPhone ?? null;

    // If customerId provided, look up customer name/phone
    if (input.customerId) {
      const { data: customer } = await client
        .from('customers')
        .select('full_name, phone')
        .eq('id', input.customerId)
        .eq('tenant_id', tenantId)
        .single();

      if (customer) {
        customerName = customer.full_name;
        customerPhone = customer.phone;
      }
    }

    const { data, error } = await client
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        customer_id: input.customerId || null,
        vehicle_id: input.vehicleId || null,
        scheduled_date: input.scheduledDate,
        scheduled_time: input.scheduledTime,
        duration_minutes: input.durationMinutes ?? 60,
        service_type: input.serviceType,
        description: input.description || null,
        technician_id: input.technicianId || null,
        bay_number: input.bayNumber ?? null,
        status: 'scheduled',
        customer_name: customerName,
        customer_phone: customerPhone,
        notes: input.notes || null,
        created_by: userId,
      })
      .select(
        '*, customer:customers(id, full_name), vehicle:vehicles(id, plate, make, model), technician:technicians(id, full_name)',
      )
      .single();

    if (error) throw error;

    return data;
  }

  async update(tenantId: string, id: string, userId: string, input: UpdateAppointmentInput) {
    await this.getById(tenantId, id);

    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      customerId: 'customer_id',
      vehicleId: 'vehicle_id',
      scheduledDate: 'scheduled_date',
      scheduledTime: 'scheduled_time',
      durationMinutes: 'duration_minutes',
      serviceType: 'service_type',
      description: 'description',
      technicianId: 'technician_id',
      bayNumber: 'bay_number',
      customerName: 'customer_name',
      customerPhone: 'customer_phone',
      notes: 'notes',
    };

    for (const [camel, snake] of Object.entries(fieldMap)) {
      if ((input as Record<string, unknown>)[camel] !== undefined) {
        updateData[snake] = (input as Record<string, unknown>)[camel] ?? null;
      }
    }

    // If customerId changed, update customer name/phone
    if (input.customerId) {
      const { data: customer } = await client
        .from('customers')
        .select('full_name, phone')
        .eq('id', input.customerId)
        .eq('tenant_id', tenantId)
        .single();

      if (customer) {
        updateData['customer_name'] = customer.full_name;
        updateData['customer_phone'] = customer.phone;
      }
    }

    const { data, error } = await client
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(
        '*, customer:customers(id, full_name), vehicle:vehicles(id, plate, make, model), technician:technicians(id, full_name)',
      )
      .single();

    if (error) throw error;

    return data;
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const appointment = await this.getById(tenantId, id);

    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = { status };

    // If starting appointment, optionally create a job card and link it
    if (status === 'in_progress' && !appointment.job_card_id && appointment.vehicle_id && appointment.customer_id) {
      // Generate job number
      const { data: jobNumber, error: rpcError } = await client.rpc(
        'generate_job_number',
        { p_tenant_id: tenantId },
      );

      if (!rpcError && jobNumber) {
        const { data: jobCard } = await client
          .from('job_cards')
          .insert({
            tenant_id: tenantId,
            job_number: jobNumber,
            vehicle_id: appointment.vehicle_id,
            customer_id: appointment.customer_id,
            reported_problem: appointment.description || appointment.service_type,
            status: 'received',
            is_insurance: false,
            is_taxable: true,
            requires_authorization: false,
            labels: [],
            parts_issuing_mode: 'auto',
            labour_total: 0,
            parts_total: 0,
            tax_amount: 0,
            grand_total: 0,
            created_by: appointment.created_by,
            updated_by: appointment.created_by,
          })
          .select('id')
          .single();

        if (jobCard) {
          updateData['job_card_id'] = jobCard.id;

          // Insert initial status history record for the job card
          await client.from('job_status_history').insert({
            tenant_id: tenantId,
            job_card_id: jobCard.id,
            from_status: null,
            to_status: 'received',
            changed_by: appointment.created_by,
            notes: `Created from appointment`,
          });
        }
      }
    }

    const { data, error } = await client
      .from('appointments')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select(
        '*, customer:customers(id, full_name), vehicle:vehicles(id, plate, make, model), technician:technicians(id, full_name)',
      )
      .single();

    if (error) throw error;

    return data;
  }

  async getByDate(tenantId: string, date: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('appointments')
      .select(
        '*, customer:customers(id, full_name), vehicle:vehicles(id, plate, make, model), technician:technicians(id, full_name)',
      )
      .eq('tenant_id', tenantId)
      .eq('scheduled_date', date)
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    return data ?? [];
  }

  async getAvailableSlots(tenantId: string, date: string, durationMinutes: number) {
    const client = this.supabase.getClient();

    // Get existing appointments for the date
    const { data: existing, error } = await client
      .from('appointments')
      .select('scheduled_time, duration_minutes')
      .eq('tenant_id', tenantId)
      .eq('scheduled_date', date)
      .not('status', 'eq', 'cancelled')
      .order('scheduled_time', { ascending: true });

    if (error) throw error;

    // Business hours: 8:00 - 18:00
    const startHour = 8;
    const endHour = 18;
    const slotInterval = 30; // Check every 30 minutes

    const bookedSlots = (existing ?? []).map((appt) => {
      const [h, m] = appt.scheduled_time.split(':').map(Number);
      const startMin = h * 60 + m;
      const endMin = startMin + (appt.duration_minutes || 60);
      return { start: startMin, end: endMin };
    });

    const availableSlots: string[] = [];

    for (let minutes = startHour * 60; minutes + durationMinutes <= endHour * 60; minutes += slotInterval) {
      const slotEnd = minutes + durationMinutes;

      const hasConflict = bookedSlots.some(
        (booked) => minutes < booked.end && slotEnd > booked.start,
      );

      if (!hasConflict) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        availableSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }

    return availableSlots;
  }

  /**
   * Ensure the appointment has a public reschedule token. Called
   * when the appointment is confirmed so the confirmation WhatsApp
   * can embed the link. Idempotent — reuses an existing unexpired
   * token rather than churning a new one.
   */
  async ensureRescheduleToken(tenantId: string, appointmentId: string) {
    const client = this.supabase.getClient();
    const { data: existing } = await client
      .from('appointments')
      .select('reschedule_token, reschedule_token_expires_at, scheduled_start')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .single();
    if (!existing) throw new NotFoundException('Appointment not found');

    const now = Date.now();
    const stillValid =
      existing.reschedule_token &&
      existing.reschedule_token_expires_at &&
      new Date(existing.reschedule_token_expires_at as string).getTime() > now;

    if (stillValid) return { token: existing.reschedule_token as string };

    const token = crypto.randomBytes(20).toString('hex');
    const anchor = existing.scheduled_start
      ? new Date(existing.scheduled_start as string).getTime()
      : now;
    const expiresAt = new Date(anchor + RESCHEDULE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await client
      .from('appointments')
      .update({ reschedule_token: token, reschedule_token_expires_at: expiresAt })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    return { token, expiresAt };
  }

  /**
   * Public-facing getter — token in, sanitised appointment out.
   * No tenant scoping: the token IS the authorisation.
   */
  async getByRescheduleToken(token: string) {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('appointments')
      .select(
        'id, tenant_id, status, scheduled_start, scheduled_end, service_type, reschedule_token_expires_at, vehicle:vehicles(plate, make, model), tenant:tenants(name, booking_slot_minutes)',
      )
      .eq('reschedule_token', token)
      .limit(1)
      .maybeSingle();
    if (!data) throw new NotFoundException('Reschedule link not found');
    const expiresAt = data.reschedule_token_expires_at as string | null;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      throw new NotFoundException('Reschedule link has expired');
    }
    if (data.status === 'completed' || data.status === 'cancelled') {
      throw new NotFoundException('Appointment can no longer be rescheduled');
    }

    const tenant = Array.isArray(data.tenant)
      ? (data.tenant[0] as Record<string, unknown> | undefined)
      : (data.tenant as Record<string, unknown> | null);
    const vehicle = Array.isArray(data.vehicle)
      ? (data.vehicle[0] as Record<string, unknown> | undefined)
      : (data.vehicle as Record<string, unknown> | null);

    return {
      id: data.id,
      tenant_id: data.tenant_id,
      status: data.status,
      scheduled_start: data.scheduled_start,
      scheduled_end: data.scheduled_end,
      service_type: data.service_type,
      workshop: tenant ? { name: tenant.name, slot_minutes: tenant.booking_slot_minutes ?? 30 } : null,
      vehicle,
    };
  }

  /**
   * Apply a new slot via the public reschedule token. Bumps
   * reschedule_count so the shop can see how often this happens.
   */
  async applyReschedule(token: string, newStartIso: string, newEndIso: string) {
    const client = this.supabase.getClient();
    const record = await this.getByRescheduleToken(token);

    const { data, error } = await client
      .from('appointments')
      .update({
        scheduled_start: newStartIso,
        scheduled_end: newEndIso,
        reschedule_count: (record as unknown as { reschedule_count?: number }).reschedule_count
          ? ((record as unknown as { reschedule_count: number }).reschedule_count ?? 0) + 1
          : 1,
      })
      .eq('id', record.id as string)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}
