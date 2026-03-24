import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateAppointmentInput, UpdateAppointmentInput } from '@mecanix/validators';

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
}
