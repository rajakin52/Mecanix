import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { JobsService } from './jobs.service';
import { InspectionsService } from '../inspections/inspections.service';
import type { CreateLabourLineInput, UpdateLabourLineInput } from '@mecanix/validators';

@Injectable()
export class LabourLinesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jobsService: JobsService,
    private readonly inspectionsService: InspectionsService,
  ) {}

  async list(tenantId: string, jobCardId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('labour_lines')
      .select('*, technician:technicians(id, full_name)')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  async create(
    tenantId: string,
    jobCardId: string,
    userId: string,
    input: CreateLabourLineInput,
  ) {
    // Require vehicle inspection before adding work items
    await this.inspectionsService.requireInspection(tenantId, jobCardId);

    const subtotal = Math.round(input.hours * input.rate * 100) / 100;

    const { data, error } = await this.supabase
      .getClient()
      .from('labour_lines')
      .insert({
        tenant_id: tenantId,
        job_card_id: jobCardId,
        description: input.description,
        hours: input.hours,
        rate: input.rate,
        subtotal,
        technician_id: input.technicianId || null,
      })
      .select()
      .single();

    if (error) throw error;

    await this.jobsService.recalculateTotals(tenantId, jobCardId);

    return data;
  }

  async update(
    tenantId: string,
    id: string,
    userId: string,
    input: UpdateLabourLineInput,
  ) {
    // Get existing line
    const { data: existing, error: fetchError } = await this.supabase
      .getClient()
      .from('labour_lines')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !existing) {
      throw new NotFoundException('Labour line not found');
    }

    const hours = input.hours ?? existing.hours;
    const rate = input.rate ?? existing.rate;
    const subtotal = Math.round(hours * rate * 100) / 100;

    const updateData: Record<string, unknown> = {
      subtotal,
    };

    if (input.description !== undefined) updateData['description'] = input.description;
    if (input.hours !== undefined) updateData['hours'] = input.hours;
    if (input.rate !== undefined) updateData['rate'] = input.rate;
    if (input.technicianId !== undefined) updateData['technician_id'] = input.technicianId || null;

    const { data, error } = await this.supabase
      .getClient()
      .from('labour_lines')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    await this.jobsService.recalculateTotals(tenantId, existing.job_card_id);

    return data;
  }

  async delete(tenantId: string, id: string, jobCardId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('labour_lines')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    await this.jobsService.recalculateTotals(tenantId, jobCardId);

    return { deleted: true };
  }

  async chargePlannedLine(tenantId: string, id: string) {
    const client = this.supabase.getClient();

    const { data: line, error: fetchError } = await client
      .from('labour_lines')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !line) throw new NotFoundException('Labour line not found');
    if (line.line_status === 'charged') {
      throw new BadRequestException('Line is already charged');
    }

    const { data, error } = await client
      .from('labour_lines')
      .update({ line_status: 'charged' })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    await this.jobsService.recalculateTotals(tenantId, line.job_card_id);
    return data;
  }
}
