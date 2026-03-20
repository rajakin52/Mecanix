import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ClockService {
  constructor(private readonly supabase: SupabaseService) {}

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async clockIn(tenantId: string, technicianId: string) {
    const client = this.supabase.getClient();
    const today = this.getToday();

    // Check if already clocked in today
    const { data: existing } = await client
      .from('clock_records')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('technician_id', technicianId)
      .eq('date', today)
      .is('clock_out', null)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new BadRequestException('Already clocked in');
    }

    const { data, error } = await client
      .from('clock_records')
      .insert({
        tenant_id: tenantId,
        technician_id: technicianId,
        date: today,
        clock_in: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async clockOut(tenantId: string, technicianId: string) {
    const client = this.supabase.getClient();
    const today = this.getToday();

    const { data: record, error: fetchError } = await client
      .from('clock_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('technician_id', technicianId)
      .eq('date', today)
      .is('clock_out', null)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!record) {
      throw new BadRequestException('Not clocked in');
    }

    const now = new Date();
    const clockIn = new Date(record.clock_in);
    const totalMinutes = Math.floor((now.getTime() - clockIn.getTime()) / 60000);

    const { data, error } = await client
      .from('clock_records')
      .update({
        clock_out: now.toISOString(),
        total_minutes: totalMinutes,
      })
      .eq('id', record.id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getTodayRecord(tenantId: string, technicianId: string) {
    const client = this.supabase.getClient();
    const today = this.getToday();

    const { data, error } = await client
      .from('clock_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('technician_id', technicianId)
      .eq('date', today)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  async getHistory(
    tenantId: string,
    technicianId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const client = this.supabase.getClient();

    let query = client
      .from('clock_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('technician_id', technicianId)
      .order('date', { ascending: false });

    if (startDate) {
      query = query.gte('date', startDate);
    }
    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ?? [];
  }
}
