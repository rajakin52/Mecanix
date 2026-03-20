import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class TimeService {
  constructor(private readonly supabase: SupabaseService) {}

  async startTimer(tenantId: string, technicianId: string, jobCardId: string) {
    const client = this.supabase.getClient();

    // Check no other timer is running for this technician
    const { data: existing } = await client
      .from('time_entries')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('technician_id', technicianId)
      .eq('status', 'running')
      .limit(1);

    if (existing && existing.length > 0) {
      throw new BadRequestException('A timer is already running');
    }

    const { data, error } = await client
      .from('time_entries')
      .insert({
        tenant_id: tenantId,
        technician_id: technicianId,
        job_card_id: jobCardId,
        status: 'running',
        started_at: new Date().toISOString(),
        total_seconds: 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async pauseTimer(tenantId: string, timeEntryId: string) {
    const client = this.supabase.getClient();

    const { data: entry, error: fetchError } = await client
      .from('time_entries')
      .select('*')
      .eq('id', timeEntryId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !entry) {
      throw new NotFoundException('Time entry not found');
    }

    if (entry.status !== 'running') {
      throw new BadRequestException('Timer is not running');
    }

    const now = new Date();
    const startedAt = new Date(entry.started_at);
    const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
    const totalSeconds = (entry.total_seconds || 0) + elapsed;

    const { data, error } = await client
      .from('time_entries')
      .update({
        status: 'paused',
        paused_at: now.toISOString(),
        total_seconds: totalSeconds,
      })
      .eq('id', timeEntryId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async resumeTimer(tenantId: string, timeEntryId: string) {
    const client = this.supabase.getClient();

    const { data: entry, error: fetchError } = await client
      .from('time_entries')
      .select('*')
      .eq('id', timeEntryId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !entry) {
      throw new NotFoundException('Time entry not found');
    }

    if (entry.status !== 'paused') {
      throw new BadRequestException('Timer is not paused');
    }

    const { data, error } = await client
      .from('time_entries')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        paused_at: null,
      })
      .eq('id', timeEntryId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async stopTimer(tenantId: string, timeEntryId: string, notes?: string) {
    const client = this.supabase.getClient();

    const { data: entry, error: fetchError } = await client
      .from('time_entries')
      .select('*')
      .eq('id', timeEntryId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !entry) {
      throw new NotFoundException('Time entry not found');
    }

    if (entry.status !== 'running' && entry.status !== 'paused') {
      throw new BadRequestException('Timer is not active');
    }

    const now = new Date();
    let totalSeconds = entry.total_seconds || 0;

    // If running, add elapsed since last started_at
    if (entry.status === 'running') {
      const startedAt = new Date(entry.started_at);
      const elapsed = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
      totalSeconds += elapsed;
    }

    const { data, error } = await client
      .from('time_entries')
      .update({
        status: 'completed',
        ended_at: now.toISOString(),
        total_seconds: totalSeconds,
        notes: notes || null,
      })
      .eq('id', timeEntryId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getActiveTimer(tenantId: string, technicianId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('time_entries')
      .select(
        '*, job_card:job_cards(id, job_number, reported_problem), vehicle:job_cards(vehicle:vehicles(id, plate, make, model))',
      )
      .eq('tenant_id', tenantId)
      .eq('technician_id', technicianId)
      .in('status', ['running', 'paused'])
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  async listByTechnician(tenantId: string, technicianId: string, date?: string) {
    const client = this.supabase.getClient();

    let query = client
      .from('time_entries')
      .select('*, job_card:job_cards(id, job_number)')
      .eq('tenant_id', tenantId)
      .eq('technician_id', technicianId)
      .order('started_at', { ascending: false });

    if (date) {
      query = query
        .gte('started_at', `${date}T00:00:00`)
        .lt('started_at', `${date}T23:59:59.999`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data ?? [];
  }

  async listByJob(tenantId: string, jobCardId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('time_entries')
      .select('*, technician:technicians(id, full_name)')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .order('started_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getTechnicianStats(tenantId: string, technicianId: string, date: string) {
    const client = this.supabase.getClient();

    const { data: entries, error } = await client
      .from('time_entries')
      .select('total_seconds, job_card_id, status')
      .eq('tenant_id', tenantId)
      .eq('technician_id', technicianId)
      .gte('started_at', `${date}T00:00:00`)
      .lt('started_at', `${date}T23:59:59.999`);

    if (error) throw error;

    const rows = entries ?? [];
    const totalSeconds = rows.reduce(
      (sum: number, e: { total_seconds: number }) => sum + (e.total_seconds || 0),
      0,
    );
    const uniqueJobs = new Set(rows.map((e: { job_card_id: string }) => e.job_card_id));
    const completedCount = rows.filter(
      (e: { status: string }) => e.status === 'completed',
    ).length;

    return {
      hoursLogged: Math.round((totalSeconds / 3600) * 100) / 100,
      jobsWorked: uniqueJobs.size,
      jobsCompleted: completedCount,
    };
  }
}
