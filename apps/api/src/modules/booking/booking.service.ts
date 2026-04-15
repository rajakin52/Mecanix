import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class BookingService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Get workshop info by booking slug (public) */
  async getWorkshopBySlug(slug: string) {
    const { data, error } = await this.supabase.getClient()
      .from('tenants')
      .select('id, name, booking_enabled, booking_slug, booking_lead_hours, booking_slot_minutes, booking_max_days_ahead')
      .eq('booking_slug', slug)
      .eq('booking_enabled', true)
      .single();

    if (error || !data) throw new NotFoundException('Workshop not found or booking not enabled');
    return data;
  }

  /** Get available services for a workshop (public) */
  async getServices(tenantId: string) {
    const { data } = await this.supabase.getClient()
      .from('repair_catalog')
      .select('id, name, code, category, estimated_hours')
      .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
      .eq('is_active', true)
      .order('category')
      .order('name');

    return data ?? [];
  }

  /** Get available time slots for a date (public) */
  async getAvailableSlots(tenantId: string, date: string) {
    const client = this.supabase.getClient();

    // Get workshop settings
    const { data: tenant } = await client
      .from('tenants')
      .select('booking_slot_minutes')
      .eq('id', tenantId)
      .single();

    const slotMinutes = (tenant?.booking_slot_minutes as number) ?? 30;

    // Get existing appointments for that date
    const { data: existing } = await client
      .from('appointments')
      .select('scheduled_start, scheduled_end')
      .eq('tenant_id', tenantId)
      .gte('scheduled_start', `${date}T00:00:00`)
      .lt('scheduled_start', `${date}T23:59:59`)
      .not('status', 'in', '("cancelled","no_show")');

    // Generate all slots for the day (8am - 5pm)
    const bookedTimes = new Set((existing ?? []).map((a) => {
      const d = new Date(a.scheduled_start as string);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    }));

    const slots: Array<{ time: string; available: boolean }> = [];
    for (let hour = 8; hour < 17; hour++) {
      for (let min = 0; min < 60; min += slotMinutes) {
        const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        slots.push({ time, available: !bookedTimes.has(time) });
      }
    }

    return slots;
  }

  /** Submit a booking request (public, no auth) */
  async submitBookingRequest(tenantId: string, input: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    vehiclePlate?: string;
    vehicleMake?: string;
    vehicleModel?: string;
    serviceType?: string;
    catalogId?: string;
    preferredDate: string;
    preferredTime?: string;
    notes?: string;
  }) {
    // Validate date is in the future
    const date = new Date(input.preferredDate);
    if (date < new Date()) {
      throw new BadRequestException('Booking date must be in the future');
    }

    const { data, error } = await this.supabase.getClient()
      .from('booking_requests')
      .insert({
        tenant_id: tenantId,
        customer_name: input.customerName,
        customer_phone: input.customerPhone,
        customer_email: input.customerEmail ?? null,
        vehicle_plate: input.vehiclePlate ?? null,
        vehicle_make: input.vehicleMake ?? null,
        vehicle_model: input.vehicleModel ?? null,
        service_type: input.serviceType ?? null,
        catalog_id: input.catalogId ?? null,
        preferred_date: input.preferredDate,
        preferred_time: input.preferredTime ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /** List booking requests (authenticated, workshop staff) */
  async listRequests(tenantId: string, status?: string) {
    let query = this.supabase.getClient()
      .from('booking_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('preferred_date', { ascending: true });

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  /** Confirm a booking request → create appointment */
  async confirmRequest(tenantId: string, userId: string, requestId: string, input: {
    scheduledStart: string;
    scheduledEnd: string;
    technicianId?: string;
  }) {
    const client = this.supabase.getClient();

    const { data: request, error: reqErr } = await client
      .from('booking_requests')
      .select('*')
      .eq('id', requestId)
      .eq('tenant_id', tenantId)
      .single();

    if (reqErr || !request) throw new NotFoundException('Booking request not found');

    // Create appointment
    const { data: appointment, error: apptErr } = await client
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        scheduled_start: input.scheduledStart,
        scheduled_end: input.scheduledEnd,
        technician_id: input.technicianId ?? null,
        service_type: request.service_type,
        catalog_id: request.catalog_id,
        customer_notes: request.notes,
        source: 'online',
        status: 'confirmed',
        created_by: userId,
      })
      .select()
      .single();

    if (apptErr) throw apptErr;

    // Update request
    await client
      .from('booking_requests')
      .update({
        status: 'confirmed',
        appointment_id: appointment.id,
        confirmed_at: new Date().toISOString(),
        confirmed_by: userId,
      })
      .eq('id', requestId);

    return { request, appointment };
  }
}
