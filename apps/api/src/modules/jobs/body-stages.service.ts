import { Inject, Injectable, NotFoundException, BadRequestException, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { JobsService } from './jobs.service';
import type { UpsertJobBodyStagesInput } from '@mecanix/validators';

const FIELD_MAP: Record<keyof UpsertJobBodyStagesInput, string> = {
  disassemblyDone: 'disassembly_done',
  frameCheckDone: 'frame_check_done',
  bodyRepairDone: 'body_repair_done',
  paintPrepDone: 'paint_prep_done',
  refinishDone: 'refinish_done',
  bakeDone: 'bake_done',
  reassemblyDone: 'reassembly_done',
  polishDone: 'polish_done',
  disassemblyNotes: 'disassembly_notes',
  frameCheckNotes: 'frame_check_notes',
  bodyRepairNotes: 'body_repair_notes',
  paintPrepNotes: 'paint_prep_notes',
  refinishNotes: 'refinish_notes',
  bakeNotes: 'bake_notes',
  reassemblyNotes: 'reassembly_notes',
  polishNotes: 'polish_notes',
};

@Injectable()
export class BodyStagesService {
  constructor(
    private readonly supabase: SupabaseService,
    @Inject(forwardRef(() => JobsService))
    private readonly jobsService: JobsService,
  ) {}

  async getByJob(tenantId: string, jobCardId: string) {
    const { data } = await this.supabase
      .getClient()
      .from('job_body_stages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .maybeSingle();
    return data;
  }

  async upsert(tenantId: string, jobCardId: string, input: UpsertJobBodyStagesInput) {
    // Closed-card gate
    await this.jobsService.assertNotInvoiced(tenantId, jobCardId);
    const client = this.supabase.getClient();

    const { data: job } = await client
      .from('job_cards')
      .select('id, job_type')
      .eq('id', jobCardId)
      .eq('tenant_id', tenantId)
      .single();
    if (!job) throw new NotFoundException('Job card not found');
    if (job.job_type !== 'body_repair') {
      throw new BadRequestException(
        'Body-repair stages only apply to body_repair job cards. Convert the job type first.',
      );
    }

    const payload: Record<string, unknown> = {};
    for (const [camel, snake] of Object.entries(FIELD_MAP) as [
      keyof UpsertJobBodyStagesInput,
      string,
    ][]) {
      const v = input[camel];
      if (v !== undefined) payload[snake] = v;
    }

    const { data: existing } = await client
      .from('job_body_stages')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await client
        .from('job_body_stages')
        .update(payload)
        .eq('id', existing.id)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await client
      .from('job_body_stages')
      .insert({ tenant_id: tenantId, job_card_id: jobCardId, ...payload })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }
}
