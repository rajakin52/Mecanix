import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { SupabaseService } from '../supabase/supabase.service';
import { JobsService } from '../jobs/jobs.service';
import type {
  CreateAssessmentInput,
  UpdateAssessmentInput,
  UploadAssessmentPhotoInput,
  CreateAssessmentFindingInput,
  UpdateAssessmentFindingInput,
  CreateAssessmentOperationInput,
  UpdateAssessmentOperationInput,
  FinaliseAssessmentInput,
} from '@mecanix/validators';

const BUCKET = 'aida-captures';

async function compress(raw: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  const pipeline = sharp(raw).rotate();
  const meta = await pipeline.metadata();
  const buffer = await pipeline
    .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  return { buffer, width: meta.width ?? 0, height: meta.height ?? 0 };
}

@Injectable()
export class AidaService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jobsService: JobsService,
  ) {}

  // ─── assessments ─────────────────────────────────────────────
  async list(
    tenantId: string,
    filters: { vehicleId?: string; jobCardId?: string; claimId?: string; status?: string } = {},
  ) {
    let q = this.supabase
      .getClient()
      .from('damage_assessments')
      .select(
        '*, vehicle:vehicles(id, plate, make, model, year), job_card:job_cards(id, job_number), claim:insurance_claims(id, claim_number)',
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });
    if (filters.vehicleId) q = q.eq('vehicle_id', filters.vehicleId);
    if (filters.jobCardId) q = q.eq('job_card_id', filters.jobCardId);
    if (filters.claimId) q = q.eq('claim_id', filters.claimId);
    if (filters.status) q = q.eq('status', filters.status);

    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('damage_assessments')
      .select(
        '*, vehicle:vehicles(id, plate, make, model, year, vin), job_card:job_cards(id, job_number), claim:insurance_claims(id, claim_number)',
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Assessment not found');

    const [photos, findings, operations] = await Promise.all([
      client
        .from('assessment_photos')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('assessment_id', id)
        .order('uploaded_at', { ascending: true }),
      client
        .from('assessment_findings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('assessment_id', id)
        .order('created_at', { ascending: true }),
      client
        .from('assessment_operations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('assessment_id', id)
        .order('created_at', { ascending: true }),
    ]);

    return {
      ...data,
      photos: photos.data ?? [],
      findings: findings.data ?? [],
      operations: operations.data ?? [],
    };
  }

  async create(tenantId: string, userId: string, input: CreateAssessmentInput) {
    const client = this.supabase.getClient();

    const { data: vehicle } = await client
      .from('vehicles')
      .select('id')
      .eq('id', input.vehicleId)
      .eq('tenant_id', tenantId)
      .single();
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const { data, error } = await client
      .from('damage_assessments')
      .insert({
        tenant_id: tenantId,
        branch_id: input.branchId ?? null,
        vehicle_id: input.vehicleId,
        job_card_id: input.jobCardId ?? null,
        claim_id: input.claimId ?? null,
        status: 'capturing',
        source: 'manual',
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(tenantId: string, id: string, input: UpdateAssessmentInput) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.status !== undefined) patch.status = input.status;
    if (input.reviewNotes !== undefined) patch.review_notes = input.reviewNotes;

    const { data, error } = await this.supabase
      .getClient()
      .from('damage_assessments')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('Assessment not found');
    return data;
  }

  async finalise(tenantId: string, id: string, userId: string, input: FinaliseAssessmentInput) {
    await this.recalculateTotals(tenantId, id);

    const client = this.supabase.getClient();

    const { data: current } = await client
      .from('damage_assessments')
      .select('id, job_card_id, pushed_to_job_at')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (!current) throw new NotFoundException('Assessment not found');

    const pushLines =
      input.approve && current.job_card_id && !current.pushed_to_job_at;

    let pushedLineIds: string[] = [];
    if (pushLines) {
      pushedLineIds = await this.pushOperationsToJob(
        tenantId,
        id,
        current.job_card_id as string,
      );
    }

    const patch: Record<string, unknown> = {
      status: input.approve ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: userId,
      review_notes: input.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    if (pushLines) {
      patch.pushed_to_job_at = new Date().toISOString();
      patch.pushed_line_ids = pushedLineIds;
    }

    const { data, error } = await client
      .from('damage_assessments')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('Assessment not found');
    return data;
  }

  // Convert each assessment_operation into labour / parts / paint
  // lines on the linked job card. Idempotent via pushed_to_job_at
  // (the caller checks it before invoking this).
  //
  // Rate resolution for labour: re-use the most recent labour_line
  // rate on this job; fall back to the tenant_settings
  // `labour.default_hourly_rate`; fall back to 0 (shop can edit).
  private async pushOperationsToJob(
    tenantId: string,
    assessmentId: string,
    jobCardId: string,
  ): Promise<string[]> {
    const client = this.supabase.getClient();

    const { data: ops } = await client
      .from('assessment_operations')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId);
    if (!ops || ops.length === 0) return [];

    const labourRate = await this.resolveLabourRate(tenantId, jobCardId);

    const { data: defaultTax } = await client
      .from('tax_codes')
      .select('id, rate')
      .eq('tenant_id', tenantId)
      .eq('is_default', true)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    const taxCodeId = (defaultTax?.id as string | undefined) ?? null;
    const taxRate = defaultTax?.rate != null ? Number(defaultTax.rate) : null;

    const labourRows: Array<Record<string, unknown>> = [];
    const partsRows: Array<Record<string, unknown>> = [];

    for (const op of ops as Array<Record<string, unknown>>) {
      const panel = String(op.panel ?? 'panel');
      const operation = String(op.operation ?? 'repair');
      const hours = Number(op.labour_hours ?? 0);
      const partsCost = Number(op.parts_cost ?? 0);
      const paintCost = Number(op.paint_cost ?? 0);
      const oem = op.oem_part_number as string | null;
      const prettyPanel = panel.replace(/_/g, ' ');

      if (hours > 0) {
        labourRows.push({
          tenant_id: tenantId,
          job_card_id: jobCardId,
          description: `${prettyPanel} — ${operation} (AIDA)`,
          hours,
          rate: labourRate,
          subtotal: Math.round(hours * labourRate * 100) / 100,
          tax_code_id: taxCodeId,
          tax_rate: taxRate,
        });
      }

      if (partsCost > 0) {
        partsRows.push({
          tenant_id: tenantId,
          job_card_id: jobCardId,
          part_name: `${prettyPanel}${oem ? ` (${oem})` : ''}`,
          part_number: oem,
          quantity: 1,
          unit_cost: partsCost,
          markup_pct: 0,
          sell_price: partsCost,
          subtotal: partsCost,
          tax_code_id: taxCodeId,
          tax_rate: taxRate,
        });
      }

      if (paintCost > 0) {
        partsRows.push({
          tenant_id: tenantId,
          job_card_id: jobCardId,
          part_name: `${prettyPanel} — paint material`,
          part_number: null,
          quantity: 1,
          unit_cost: paintCost,
          markup_pct: 0,
          sell_price: paintCost,
          subtotal: paintCost,
          tax_code_id: taxCodeId,
          tax_rate: taxRate,
        });
      }
    }

    const insertedIds: string[] = [];

    if (labourRows.length > 0) {
      const { data: inserted, error } = await client
        .from('labour_lines')
        .insert(labourRows)
        .select('id');
      if (error) throw new BadRequestException(`Failed to add labour lines: ${error.message}`);
      for (const row of inserted ?? []) insertedIds.push(String(row.id));
    }

    if (partsRows.length > 0) {
      const { data: inserted, error } = await client
        .from('parts_lines')
        .insert(partsRows)
        .select('id');
      if (error) throw new BadRequestException(`Failed to add parts lines: ${error.message}`);
      for (const row of inserted ?? []) insertedIds.push(String(row.id));
    }

    // Refresh job totals so the detail view shows the new lines.
    await this.jobsService.recalculateTotals(tenantId, jobCardId);

    return insertedIds;
  }

  private async resolveLabourRate(tenantId: string, jobCardId: string): Promise<number> {
    const client = this.supabase.getClient();

    const { data: existing } = await client
      .from('labour_lines')
      .select('rate')
      .eq('tenant_id', tenantId)
      .eq('job_card_id', jobCardId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.rate != null) return Number(existing.rate);

    const { data: setting } = await client
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'labour.default_hourly_rate')
      .maybeSingle();
    if (setting?.value != null) {
      const n = Number(setting.value);
      if (Number.isFinite(n)) return n;
    }

    const { data: tech } = await client
      .from('technicians')
      .select('hourly_rate')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('hourly_rate', 'is', null)
      .order('hourly_rate', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tech?.hourly_rate != null) return Number(tech.hourly_rate);

    return 0;
  }

  async delete(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('damage_assessments')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return { deleted: true };
  }

  // ─── photos ──────────────────────────────────────────────────
  async uploadPhoto(
    tenantId: string,
    assessmentId: string,
    userId: string,
    input: UploadAssessmentPhotoInput,
  ) {
    const client = this.supabase.getClient();

    const { data: assessment } = await client
      .from('damage_assessments')
      .select('id')
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId)
      .single();
    if (!assessment) throw new NotFoundException('Assessment not found');

    const base64 = input.file.replace(/^data:image\/\w+;base64,/, '');
    const raw = Buffer.from(base64, 'base64');
    if (raw.length === 0) throw new BadRequestException('Empty image payload');

    const { buffer, width, height } = await compress(raw);
    const path = `${tenantId}/${assessmentId}/${Date.now()}-${input.filename.replace(/[^\w.-]/g, '_')}.jpg`;

    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) throw uploadError;

    const { data: urlData } = client.storage.from(BUCKET).getPublicUrl(path);

    const { data, error } = await client
      .from('assessment_photos')
      .insert({
        tenant_id: tenantId,
        assessment_id: assessmentId,
        storage_path: path,
        public_url: urlData.publicUrl,
        view_angle: input.viewAngle ?? null,
        panel_hint: input.panelHint ?? null,
        width_px: width,
        height_px: height,
        exif_lat: input.exifLat ?? null,
        exif_lng: input.exifLng ?? null,
        exif_taken_at: input.exifTakenAt ?? null,
        uploaded_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deletePhoto(tenantId: string, assessmentId: string, photoId: string) {
    const client = this.supabase.getClient();
    const { data: photo } = await client
      .from('assessment_photos')
      .select('storage_path')
      .eq('id', photoId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .single();
    if (!photo) throw new NotFoundException('Photo not found');

    if (photo.storage_path) {
      await client.storage.from(BUCKET).remove([photo.storage_path as string]);
    }
    const { error } = await client
      .from('assessment_photos')
      .delete()
      .eq('id', photoId)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return { deleted: true };
  }

  // ─── findings ────────────────────────────────────────────────
  async addFinding(
    tenantId: string,
    assessmentId: string,
    userId: string,
    input: CreateAssessmentFindingInput,
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('assessment_findings')
      .insert({
        tenant_id: tenantId,
        assessment_id: assessmentId,
        panel: input.panel,
        damage_type: input.damageType,
        severity: input.severity,
        area_pct: input.areaPct ?? null,
        confidence: input.confidence ?? null,
        source: input.source,
        model_version: input.modelVersion ?? null,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    await this.recalculateTotals(tenantId, assessmentId);
    return data;
  }

  async updateFinding(
    tenantId: string,
    assessmentId: string,
    findingId: string,
    input: UpdateAssessmentFindingInput,
  ) {
    const patch: Record<string, unknown> = {};
    if (input.panel !== undefined) patch.panel = input.panel;
    if (input.damageType !== undefined) patch.damage_type = input.damageType;
    if (input.severity !== undefined) patch.severity = input.severity;
    if (input.areaPct !== undefined) patch.area_pct = input.areaPct;
    if (input.confidence !== undefined) patch.confidence = input.confidence;
    if (input.source !== undefined) patch.source = input.source;
    if (input.modelVersion !== undefined) patch.model_version = input.modelVersion;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await this.supabase
      .getClient()
      .from('assessment_findings')
      .update(patch)
      .eq('id', findingId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('Finding not found');
    await this.recalculateTotals(tenantId, assessmentId);
    return data;
  }

  async deleteFinding(tenantId: string, assessmentId: string, findingId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('assessment_findings')
      .delete()
      .eq('id', findingId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId);
    if (error) throw error;
    await this.recalculateTotals(tenantId, assessmentId);
    return { deleted: true };
  }

  // ─── operations ──────────────────────────────────────────────
  async addOperation(
    tenantId: string,
    assessmentId: string,
    userId: string,
    input: CreateAssessmentOperationInput,
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('assessment_operations')
      .insert({
        tenant_id: tenantId,
        assessment_id: assessmentId,
        finding_id: input.findingId ?? null,
        panel: input.panel,
        operation: input.operation,
        labour_hours: input.labourHours,
        parts_cost: input.partsCost,
        paint_cost: input.paintCost,
        oem_part_number: input.oemPartNumber ?? null,
        source: input.source,
        notes: input.notes ?? null,
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    await this.recalculateTotals(tenantId, assessmentId);
    return data;
  }

  async updateOperation(
    tenantId: string,
    assessmentId: string,
    opId: string,
    input: UpdateAssessmentOperationInput,
  ) {
    const patch: Record<string, unknown> = {};
    if (input.findingId !== undefined) patch.finding_id = input.findingId;
    if (input.panel !== undefined) patch.panel = input.panel;
    if (input.operation !== undefined) patch.operation = input.operation;
    if (input.labourHours !== undefined) patch.labour_hours = input.labourHours;
    if (input.partsCost !== undefined) patch.parts_cost = input.partsCost;
    if (input.paintCost !== undefined) patch.paint_cost = input.paintCost;
    if (input.oemPartNumber !== undefined) patch.oem_part_number = input.oemPartNumber;
    if (input.source !== undefined) patch.source = input.source;
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await this.supabase
      .getClient()
      .from('assessment_operations')
      .update(patch)
      .eq('id', opId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('Operation not found');
    await this.recalculateTotals(tenantId, assessmentId);
    return data;
  }

  async deleteOperation(tenantId: string, assessmentId: string, opId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('assessment_operations')
      .delete()
      .eq('id', opId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId);
    if (error) throw error;
    await this.recalculateTotals(tenantId, assessmentId);
    return { deleted: true };
  }

  // ─── totals rollup ───────────────────────────────────────────
  // Cheap and good enough for the alpha. Will be replaced by a worker
  // when AIDA model output is wired up — until then this keeps the
  // list view honest on every mutation.
  private async recalculateTotals(tenantId: string, assessmentId: string) {
    const client = this.supabase.getClient();
    const [{ data: ops }, { data: findings }] = await Promise.all([
      client
        .from('assessment_operations')
        .select('labour_hours, parts_cost, paint_cost')
        .eq('tenant_id', tenantId)
        .eq('assessment_id', assessmentId),
      client
        .from('assessment_findings')
        .select('confidence')
        .eq('tenant_id', tenantId)
        .eq('assessment_id', assessmentId),
    ]);

    const opsRows = ops ?? [];
    const totalHours = opsRows.reduce((s, r) => s + Number(r.labour_hours || 0), 0);
    const totalParts = opsRows.reduce((s, r) => s + Number(r.parts_cost || 0), 0);
    const totalPaint = opsRows.reduce((s, r) => s + Number(r.paint_cost || 0), 0);

    const confidences = (findings ?? [])
      .map((r) => Number(r.confidence))
      .filter((n) => Number.isFinite(n));
    const confidenceAvg = confidences.length
      ? confidences.reduce((s, n) => s + n, 0) / confidences.length
      : null;

    await client
      .from('damage_assessments')
      .update({
        total_hours: totalHours,
        total_parts_cost: totalParts,
        total_paint_cost: totalPaint,
        total_estimate: totalParts + totalPaint, // labour cost computed at job-card time using shop rate
        confidence_avg: confidenceAvg,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId);
  }
}
