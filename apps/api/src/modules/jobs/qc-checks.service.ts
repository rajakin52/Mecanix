import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { UpsertJobQcInput } from '@mecanix/validators';

const FIELD_MAP: Record<keyof UpsertJobQcInput, string> = {
  allWorkCompleted: 'all_work_completed',
  testDriveDone: 'test_drive_done',
  testDriveNotes: 'test_drive_notes',
  washDone: 'wash_done',
  fluidLevelsChecked: 'fluid_levels_checked',
  torqueRecheckDone: 'torque_recheck_done',
  codesCleared: 'codes_cleared',
  toolsRemoved: 'tools_removed',
  personalItemsVerified: 'personal_items_verified',
  mileageOut: 'mileage_out',
  notes: 'notes',
  passed: 'passed',
  signatureUrl: 'signature_url',
};

@Injectable()
export class QcChecksService {
  constructor(private readonly supabase: SupabaseService) {}

  async getByJob(tenantId: string, jobCardId: string) {
    const { data } = await this.supabase
      .getClient()
      .from('job_qc_checks')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .maybeSingle();
    return data;
  }

  async upsert(
    tenantId: string,
    jobCardId: string,
    userId: string,
    input: UpsertJobQcInput,
  ) {
    const client = this.supabase.getClient();

    const { data: job, error: jobErr } = await client
      .from('job_cards')
      .select('id')
      .eq('id', jobCardId)
      .eq('tenant_id', tenantId)
      .single();
    if (jobErr || !job) throw new NotFoundException('Job card not found');

    const payload: Record<string, unknown> = {};
    for (const [camel, snake] of Object.entries(FIELD_MAP) as [
      keyof UpsertJobQcInput,
      string,
    ][]) {
      const v = input[camel];
      if (v !== undefined) payload[snake] = v;
    }

    // When the form is submitted as passed, capture who/when.
    if (input.passed === true) {
      payload.qc_by = userId;
      payload.qc_performed_at = new Date().toISOString();
    }

    const { data: existing } = await client
      .from('job_qc_checks')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .maybeSingle();

    if (existing) {
      const { data, error } = await client
        .from('job_qc_checks')
        .update(payload)
        .eq('id', existing.id)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await client
      .from('job_qc_checks')
      .insert({
        tenant_id: tenantId,
        job_card_id: jobCardId,
        ...payload,
      })
      .select('*')
      .single();
    if (error) throw error;
    return data;
  }

  /** Returns true when the job has a passed QC record. */
  async isPassed(tenantId: string, jobCardId: string): Promise<boolean> {
    const { data } = await this.supabase
      .getClient()
      .from('job_qc_checks')
      .select('passed')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .maybeSingle();
    return Boolean(data?.passed);
  }
}
