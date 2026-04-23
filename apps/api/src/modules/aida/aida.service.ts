import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { SupabaseService } from '../supabase/supabase.service';
import { JobsService } from '../jobs/jobs.service';
import { AiService } from '../ai/ai.service';
import type {
  CreateAssessmentInput,
  UpdateAssessmentInput,
  UploadAssessmentPhotoInput,
  CreateAssessmentFindingInput,
  UpdateAssessmentFindingInput,
  CreateAssessmentOperationInput,
  UpdateAssessmentOperationInput,
  FinaliseAssessmentInput,
  CreateClaimFromAssessmentInput,
} from '@mecanix/validators';

const BUCKET = 'aida-captures';
const PACKET_BUCKET = 'aida-packets';
const MODEL_VERSION = 'claude-opus-4-7';
const CAPTURE_TOKEN_TTL_DAYS = 14;

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
    private readonly aiService: AiService,
    private readonly config: ConfigService,
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
        '*, vehicle:vehicles(id, plate, make, model, year, vin), job_card:job_cards(id, job_number), claim:insurance_claims(id, claim_number, status, insurance_company:insurance_companies(id, name))',
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

    // Link / unlink to an existing insurance claim. Null clears, undefined
    // leaves the value alone. When setting, verify the claim belongs to
    // the same tenant to prevent cross-tenant leakage.
    if (input.claimId !== undefined) {
      if (input.claimId === null) {
        patch.claim_id = null;
      } else {
        const { data: claim } = await this.supabase
          .getClient()
          .from('insurance_claims')
          .select('id, tenant_id')
          .eq('id', input.claimId)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (!claim) throw new NotFoundException('Claim not found');
        patch.claim_id = input.claimId;
      }
    }

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

  /**
   * Create a new insurance claim from the assessment and link them.
   * The claim is created with no job_card_id (supported since migration
   * 00102) so the workshop can run insurance work standalone. Totals
   * from the assessment are copied into workshop_estimate as a starting
   * figure — the estimator can revise on the claim detail page.
   */
  async createClaimFromAssessment(
    tenantId: string,
    assessmentId: string,
    userId: string,
    input: CreateClaimFromAssessmentInput,
  ): Promise<{ claimId: string; claimNumber: string }> {
    const client = this.supabase.getClient();

    const { data: assessment } = await client
      .from('damage_assessments')
      .select('id, claim_id, total_estimate')
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!assessment) throw new NotFoundException('Assessment not found');
    if (assessment.claim_id) {
      throw new BadRequestException('Assessment is already linked to a claim');
    }

    // Verify the insurer belongs to the tenant.
    const { data: insurer } = await client
      .from('insurance_companies')
      .select('id')
      .eq('id', input.insuranceCompanyId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!insurer) throw new NotFoundException('Insurance company not found');

    const { data: claimNumber, error: rpcError } = await client.rpc('generate_claim_number', {
      p_tenant_id: tenantId,
    });
    if (rpcError || !claimNumber) {
      throw new BadRequestException('Failed to generate claim number');
    }

    const { data: claim, error: insertError } = await client
      .from('insurance_claims')
      .insert({
        tenant_id: tenantId,
        job_card_id: null,
        insurance_company_id: input.insuranceCompanyId,
        claim_number: claimNumber,
        policy_number: input.policyNumber ?? null,
        excess_amount: input.excessAmount ?? 0,
        workshop_estimate: Number(assessment.total_estimate ?? 0),
        status: 'initiated',
        created_by: userId,
      })
      .select('id, claim_number')
      .single();
    if (insertError || !claim) {
      throw new BadRequestException(
        `Failed to create claim: ${insertError?.message ?? 'unknown error'}`,
      );
    }

    // Link the assessment to the new claim.
    await client
      .from('damage_assessments')
      .update({ claim_id: claim.id, updated_at: new Date().toISOString() })
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId);

    return { claimId: claim.id as string, claimNumber: claim.claim_number as string };
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

  // ─── analyse (Claude vision) ─────────────────────────────────
  // Pull every photo on the assessment, send to Claude, write the
  // returned findings + operations as model-sourced rows. Idempotent:
  // if the assessment already has an analysed_at and force=false,
  // returns the existing rows without re-billing the API.
  async analyse(
    tenantId: string,
    assessmentId: string,
    userId: string,
    options: { force?: boolean } = {},
  ) {
    const client = this.supabase.getClient();

    const { data: assessment } = await client
      .from('damage_assessments')
      .select('id, status, analysed_at, vehicle_id')
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId)
      .single();
    if (!assessment) throw new NotFoundException('Assessment not found');

    if (assessment.analysed_at && !options.force) {
      return this.getById(tenantId, assessmentId);
    }

    // Monthly cost cap. Default 200 analyses/month/tenant. Override
    // via tenant_settings 'aida.monthly_analyses_max'. The cap counts
    // analyses actually run this calendar month (re-analyses with
    // force=true each count once).
    const stats = await this.getMonthlyStats(tenantId);
    if (stats.analysesThisMonth >= stats.monthlyAnalysesMax) {
      throw new BadRequestException(
        `Monthly AI-analysis cap reached (${stats.monthlyAnalysesMax}). Increase aida.monthly_analyses_max or wait until next month.`,
      );
    }

    const { data: photos } = await client
      .from('assessment_photos')
      .select('id, public_url, view_angle')
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .order('uploaded_at', { ascending: true });
    if (!photos || photos.length === 0) {
      throw new BadRequestException('Upload at least one photo before analysing');
    }

    const { data: vehicle } = await client
      .from('vehicles')
      .select('make, model, year')
      .eq('id', assessment.vehicle_id as string)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Pre-existing damage: pull findings from this vehicle's prior
    // approved assessments so the model doesn't double-count scratches
    // that were there last time. Scoped to the same tenant via the
    // damage_assessments.tenant_id eq. 'ready' status is included
    // because an analysed-but-not-yet-approved assessment still
    // represents damage we've already recorded.
    const { data: priorAssessments } = await client
      .from('damage_assessments')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('vehicle_id', assessment.vehicle_id as string)
      .in('status', ['ready', 'approved'])
      .neq('id', assessmentId);

    let priorDamage: Array<{ panel: string; damageType: string; severity: number }> = [];
    const priorIds = (priorAssessments ?? []).map((r) => r.id as string);
    if (priorIds.length > 0) {
      const { data: priorFindings } = await client
        .from('assessment_findings')
        .select('panel, damage_type, severity')
        .eq('tenant_id', tenantId)
        .in('assessment_id', priorIds);
      priorDamage = (priorFindings ?? []).map((f) => ({
        panel: String(f.panel ?? ''),
        damageType: String(f.damage_type ?? ''),
        severity: Number(f.severity ?? 0),
      }));
    }

    await client
      .from('damage_assessments')
      .update({ status: 'analysing', updated_at: new Date().toISOString() })
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId);

    // Download each photo and convert to base64. Photos are uploaded
    // as JPEG by uploadPhoto() above, so media type is always image/jpeg.
    // photoIdsInOrder aligns with the index the model sees, so we can
    // map its photo_index back to the real assessment_photos.id.
    const photoPayloads: Array<{ base64: string; mediaType: string; viewAngle?: string }> = [];
    const photoIdsInOrder: string[] = [];
    for (const p of photos) {
      const url = p.public_url as string | null;
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        photoPayloads.push({
          base64: buf.toString('base64'),
          mediaType: 'image/jpeg',
          viewAngle: (p.view_angle as string | null) ?? undefined,
        });
        photoIdsInOrder.push(p.id as string);
      } catch {
        // Skip unreadable photo; analysis proceeds on the rest.
      }
    }

    if (photoPayloads.length === 0) {
      await client
        .from('damage_assessments')
        .update({ status: 'capturing', updated_at: new Date().toISOString() })
        .eq('id', assessmentId)
        .eq('tenant_id', tenantId);
      throw new BadRequestException('Could not read any photos from storage');
    }

    const result = await this.aiService.analyseDamage({
      photos: photoPayloads,
      vehicle: vehicle
        ? {
            make: (vehicle.make as string | null) ?? undefined,
            model: (vehicle.model as string | null) ?? undefined,
            year: (vehicle.year as number | null) ?? undefined,
          }
        : undefined,
      priorDamage: priorDamage.length > 0 ? priorDamage : undefined,
    });

    // Parse failure surfaces as a real error rather than a silent
    // empty analysis. `raw` is only set by the AI service when it
    // couldn't extract a JSON block from the model's response.
    // Legitimate "no damage detected" responses come back with
    // empty arrays and no `raw`, which we treat as a valid analysis.
    if (result.raw) {
      await client
        .from('damage_assessments')
        .update({ status: 'capturing', updated_at: new Date().toISOString() })
        .eq('id', assessmentId)
        .eq('tenant_id', tenantId);
      throw new BadRequestException(
        'AI analysis failed to return structured output. Try Re-analyse, or add findings manually.',
      );
    }

    if (options.force) {
      // Clear previous model-sourced rows so we don't stack duplicates.
      await client
        .from('assessment_operations')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('assessment_id', assessmentId)
        .eq('source', 'model');
      await client
        .from('assessment_findings')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('assessment_id', assessmentId)
        .eq('source', 'model');
    }

    const findingRows = result.findings.map((f) => {
      const photoId =
        f.photoIndex != null && f.photoIndex >= 0 && f.photoIndex < photoIdsInOrder.length
          ? (photoIdsInOrder[f.photoIndex] ?? null)
          : null;
      return {
        tenant_id: tenantId,
        assessment_id: assessmentId,
        panel: f.panel,
        damage_type: f.damageType,
        severity: f.severity,
        area_pct: f.areaPct ?? null,
        confidence: f.confidence,
        source: 'model',
        model_version: MODEL_VERSION,
        notes: f.notes ?? null,
        photo_id: photoId,
        created_by: userId,
      };
    });

    const operationRows = result.operations.map((o) => ({
      tenant_id: tenantId,
      assessment_id: assessmentId,
      panel: o.panel,
      operation: o.operation,
      labour_hours: o.labourHours,
      parts_cost: o.partsCost,
      paint_cost: o.paintCost,
      oem_part_number: o.oemPartNumber ?? null,
      source: 'model',
      notes: o.notes ?? null,
      created_by: userId,
    }));

    if (findingRows.length > 0) {
      const { error } = await client.from('assessment_findings').insert(findingRows);
      if (error) throw new BadRequestException(`Failed to save findings: ${error.message}`);
    }
    if (operationRows.length > 0) {
      const { error } = await client.from('assessment_operations').insert(operationRows);
      if (error) throw new BadRequestException(`Failed to save operations: ${error.message}`);
    }

    const nowIso = new Date().toISOString();
    await client
      .from('damage_assessments')
      .update({
        status: 'ready',
        source: 'aida_v0',
        analysed_at: nowIso,
        analysed_by_model: MODEL_VERSION,
        capture_ended_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId);

    await this.recalculateTotals(tenantId, assessmentId);

    return this.getById(tenantId, assessmentId);
  }

  // ─── create a body-repair job from an assessment ────────────
  // Creates a new job_card (job_type='body_repair'), links it back
  // to the assessment (damage_assessments.job_card_id), and pushes
  // the assessment's operations to it as labour + parts lines.
  //
  // Rejects if the assessment already has a linked job card — for
  // that case the advisor should use finalise() to push into the
  // existing job.
  async createJobFromAssessment(tenantId: string, assessmentId: string, userId: string) {
    const client = this.supabase.getClient();

    const { data: assessment } = await client
      .from('damage_assessments')
      .select('id, vehicle_id, job_card_id, branch_id, pushed_to_job_at')
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId)
      .single();
    if (!assessment) throw new NotFoundException('Assessment not found');

    if (assessment.job_card_id) {
      throw new BadRequestException(
        'Assessment is already linked to a job card. Use Approve to push operations to the linked job.',
      );
    }

    const { data: vehicle } = await client
      .from('vehicles')
      .select('id, plate, customer_id')
      .eq('id', assessment.vehicle_id as string)
      .eq('tenant_id', tenantId)
      .single();
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (!vehicle.customer_id) {
      throw new BadRequestException('Vehicle has no customer — assign a customer before creating a job card');
    }

    const { count: operationsCount } = await client
      .from('assessment_operations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId);
    if ((operationsCount ?? 0) === 0) {
      throw new BadRequestException(
        'Add at least one operation to the assessment (or run Analyse with AI) before creating a job card',
      );
    }

    const job = await this.jobsService.create(tenantId, userId, {
      vehicleId: assessment.vehicle_id as string,
      customerId: vehicle.customer_id as string,
      jobType: 'body_repair',
      reportedProblem: `Body repair from AIDA assessment (${operationsCount} operations)`,
      symptomCodes: [],
      isInsurance: false,
      isTaxable: true,
      requiresAuthorization: false,
      labels: [],
      partsIssuingMode: 'auto',
      isComeback: false,
      isWarranty: false,
      priorityLevel: 'normal',
      branchId: (assessment.branch_id as string | null) ?? undefined,
    });

    await client
      .from('damage_assessments')
      .update({ job_card_id: job.id, updated_at: new Date().toISOString() })
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId);

    const pushedLineIds = await this.pushOperationsToJob(tenantId, assessmentId, job.id);

    await client
      .from('damage_assessments')
      .update({
        pushed_to_job_at: new Date().toISOString(),
        pushed_line_ids: pushedLineIds,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId);

    return { jobId: job.id as string, jobNumber: job.job_number as string };
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

    // Rate resolution: AIDA-specific body-work rate wins for every
    // operation (AIDA only generates body-work ops). Falls through to
    // the job's most recent labour rate, tenant default, then 0.
    const bodyRate = await this.resolveAidaBodyLabourRate(tenantId);
    const labourRate =
      bodyRate ?? (await this.resolveLabourRate(tenantId, jobCardId));
    const defaultPaintPerPanel = await this.resolveAidaPaintMaterialRate(tenantId);

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
      // Paint material: prefer the per-op cost the AI produced; if the
      // op is a paint / blend and the AI left it at 0, apply the tenant's
      // configured default (aida.default_paint_material_rate).
      const rawPaintCost = Number(op.paint_cost ?? 0);
      const isPaintishOp = operation === 'paint' || operation === 'blend';
      const paintCost =
        rawPaintCost > 0
          ? rawPaintCost
          : isPaintishOp && defaultPaintPerPanel != null
            ? defaultPaintPerPanel
            : 0;
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

  /**
   * Effective rates for AIDA operations on this tenant, with a label
   * explaining where each one comes from. Used by the UI to show which
   * rate will apply when an assessment is converted to a job card.
   */
  async getEffectiveRates(tenantId: string): Promise<{
    bodyLabourRate: number;
    bodyLabourSource: 'aida_override' | 'workshop_default' | 'tech_max' | 'none';
    paintMaterialRate: number | null;
    paintMaterialSource: 'aida_override' | 'none';
  }> {
    const client = this.supabase.getClient();

    const aidaBody = await this.resolveAidaBodyLabourRate(tenantId);
    if (aidaBody != null) {
      const paint = await this.resolveAidaPaintMaterialRate(tenantId);
      return {
        bodyLabourRate: aidaBody,
        bodyLabourSource: 'aida_override',
        paintMaterialRate: paint,
        paintMaterialSource: paint != null ? 'aida_override' : 'none',
      };
    }

    const { data: wsDefault } = await client
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'labour.default_hourly_rate')
      .maybeSingle();
    if (wsDefault?.value != null) {
      const n = Number(wsDefault.value);
      if (Number.isFinite(n) && n > 0) {
        const paint = await this.resolveAidaPaintMaterialRate(tenantId);
        return {
          bodyLabourRate: n,
          bodyLabourSource: 'workshop_default',
          paintMaterialRate: paint,
          paintMaterialSource: paint != null ? 'aida_override' : 'none',
        };
      }
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
    if (tech?.hourly_rate != null) {
      const paint = await this.resolveAidaPaintMaterialRate(tenantId);
      return {
        bodyLabourRate: Number(tech.hourly_rate),
        bodyLabourSource: 'tech_max',
        paintMaterialRate: paint,
        paintMaterialSource: paint != null ? 'aida_override' : 'none',
      };
    }

    const paint = await this.resolveAidaPaintMaterialRate(tenantId);
    return {
      bodyLabourRate: 0,
      bodyLabourSource: 'none',
      paintMaterialRate: paint,
      paintMaterialSource: paint != null ? 'aida_override' : 'none',
    };
  }

  /**
   * AIDA-specific body-work hourly rate override. Returns null if the
   * tenant hasn't set one — caller then falls back to the general rate.
   */
  private async resolveAidaBodyLabourRate(tenantId: string): Promise<number | null> {
    const { data } = await this.supabase
      .getClient()
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'aida.default_body_labour_rate')
      .maybeSingle();
    if (data?.value == null || data.value === '') return null;
    const n = Number(data.value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  /**
   * Per-panel paint material cost used when the AI emits a paint/blend op
   * with paint_cost=0. Returns null if the tenant hasn't configured it.
   */
  private async resolveAidaPaintMaterialRate(tenantId: string): Promise<number | null> {
    const { data } = await this.supabase
      .getClient()
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'aida.default_paint_material_rate')
      .maybeSingle();
    if (data?.value == null || data.value === '') return null;
    const n = Number(data.value);
    return Number.isFinite(n) && n > 0 ? n : null;
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
    userId: string,
    input: UpdateAssessmentFindingInput,
  ) {
    const client = this.supabase.getClient();

    // Fetch full current row — used both for the source-flip diff
    // and for the assessment_edits audit log.
    const { data: current } = await client
      .from('assessment_findings')
      .select('*')
      .eq('id', findingId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .single();
    if (!current) throw new NotFoundException('Finding not found');

    const patch: Record<string, unknown> = {};
    if (input.panel !== undefined) patch.panel = input.panel;
    if (input.damageType !== undefined) patch.damage_type = input.damageType;
    if (input.severity !== undefined) patch.severity = input.severity;
    if (input.areaPct !== undefined) patch.area_pct = input.areaPct;
    if (input.confidence !== undefined) patch.confidence = input.confidence;
    if (input.source !== undefined) patch.source = input.source;
    if (input.modelVersion !== undefined) patch.model_version = input.modelVersion;
    if (input.notes !== undefined) patch.notes = input.notes;

    // Auto-flip: a human editing a model-sourced row is an override.
    // Skipped when the caller explicitly sets source (e.g. restoring).
    if (
      current.source === 'model' &&
      input.source === undefined &&
      (
        (input.panel !== undefined && input.panel !== current.panel) ||
        (input.damageType !== undefined && input.damageType !== current.damage_type) ||
        (input.severity !== undefined && input.severity !== current.severity) ||
        (input.areaPct !== undefined && input.areaPct !== current.area_pct) ||
        (input.notes !== undefined && input.notes !== current.notes)
      )
    ) {
      patch.source = 'reviewer_override';
    }

    const { data, error } = await client
      .from('assessment_findings')
      .update(patch)
      .eq('id', findingId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('Finding not found');

    await this.logEdit(tenantId, assessmentId, 'finding', findingId, userId, 'update', current, data);
    await this.recalculateTotals(tenantId, assessmentId);
    return data;
  }

  async deleteFinding(tenantId: string, assessmentId: string, findingId: string, userId: string) {
    const client = this.supabase.getClient();

    const { data: current } = await client
      .from('assessment_findings')
      .select('*')
      .eq('id', findingId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .maybeSingle();

    const { error } = await client
      .from('assessment_findings')
      .delete()
      .eq('id', findingId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId);
    if (error) throw error;

    if (current) {
      await this.logEdit(tenantId, assessmentId, 'finding', findingId, userId, 'delete', current, null);
    }
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
    userId: string,
    input: UpdateAssessmentOperationInput,
  ) {
    const client = this.supabase.getClient();

    const { data: current } = await client
      .from('assessment_operations')
      .select('*')
      .eq('id', opId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .single();
    if (!current) throw new NotFoundException('Operation not found');

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

    if (
      current.source === 'model' &&
      input.source === undefined &&
      (
        (input.panel !== undefined && input.panel !== current.panel) ||
        (input.operation !== undefined && input.operation !== current.operation) ||
        (input.labourHours !== undefined && input.labourHours !== Number(current.labour_hours)) ||
        (input.partsCost !== undefined && input.partsCost !== Number(current.parts_cost)) ||
        (input.paintCost !== undefined && input.paintCost !== Number(current.paint_cost)) ||
        (input.oemPartNumber !== undefined && input.oemPartNumber !== current.oem_part_number) ||
        (input.notes !== undefined && input.notes !== current.notes)
      )
    ) {
      patch.source = 'reviewer_override';
    }

    const { data, error } = await client
      .from('assessment_operations')
      .update(patch)
      .eq('id', opId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .select()
      .single();
    if (error || !data) throw new NotFoundException('Operation not found');

    await this.logEdit(tenantId, assessmentId, 'operation', opId, userId, 'update', current, data);
    await this.recalculateTotals(tenantId, assessmentId);
    return data;
  }

  async deleteOperation(tenantId: string, assessmentId: string, opId: string, userId: string) {
    const client = this.supabase.getClient();

    const { data: current } = await client
      .from('assessment_operations')
      .select('*')
      .eq('id', opId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .maybeSingle();

    const { error } = await client
      .from('assessment_operations')
      .delete()
      .eq('id', opId)
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId);
    if (error) throw error;

    if (current) {
      await this.logEdit(tenantId, assessmentId, 'operation', opId, userId, 'delete', current, null);
    }
    await this.recalculateTotals(tenantId, assessmentId);
    return { deleted: true };
  }

  async listEdits(tenantId: string, assessmentId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('assessment_edits')
      .select('*, editor:users(id, full_name, email)')
      .eq('tenant_id', tenantId)
      .eq('assessment_id', assessmentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  // Append-only audit log. Swallows insert errors so an audit-table
  // outage never blocks a user edit — the underlying row mutation
  // is the source of truth, this is observation only.
  private async logEdit(
    tenantId: string,
    assessmentId: string,
    entityKind: 'finding' | 'operation',
    entityId: string,
    userId: string,
    action: 'update' | 'delete',
    before: Record<string, unknown>,
    after: Record<string, unknown> | null,
  ): Promise<void> {
    try {
      await this.supabase
        .getClient()
        .from('assessment_edits')
        .insert({
          tenant_id: tenantId,
          assessment_id: assessmentId,
          entity_kind: entityKind,
          entity_id: entityId,
          action,
          before,
          after,
          editor_id: userId,
        });
    } catch {
      /* noop — audit is best-effort */
    }
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

  // ─── packet PDF ───────────────────────────────────────────────
  // Renders an assessment as a single-page (or multi-page) PDF and
  // uploads it to the aida-packets bucket. Returns the public URL.
  // Generated on-demand; each call overwrites the last rendering.
  async generatePacket(tenantId: string, assessmentId: string, userId: string) {
    const client = this.supabase.getClient();

    const detail = await this.getById(tenantId, assessmentId);
    const vehicleId = (detail as Record<string, unknown>).vehicle_id as string;

    // Fetch vehicle + customer (for customer block on the packet).
    const { data: vehicle } = await client
      .from('vehicles')
      .select('plate, make, model, year, vin, customer_id')
      .eq('id', vehicleId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    let customer: Record<string, unknown> | null = null;
    if (vehicle?.customer_id) {
      const { data } = await client
        .from('customers')
        .select('full_name, phone, email, tax_id')
        .eq('id', vehicle.customer_id as string)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      customer = (data as Record<string, unknown>) ?? null;
    }

    const { data: tenant } = await client
      .from('tenants')
      .select('name, phone, email, address')
      .eq('id', tenantId)
      .single();

    const pdfBuffer = await this.renderPacketPdf({
      tenant: (tenant ?? {}) as Record<string, unknown>,
      assessment: detail as Record<string, unknown>,
      vehicle: (vehicle ?? {}) as Record<string, unknown>,
      customer,
    });

    // Deterministic path so re-downloads update the same URL rather
    // than leaving stale files around forever. Each generation
    // overwrites. Storage-side audit: generated_by/at tracked via
    // X-Metadata but not persisted to a dedicated table in v1.
    const filename = `${tenantId}/${assessmentId}.pdf`;
    const { error: upErr } = await client.storage
      .from(PACKET_BUCKET)
      .upload(filename, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    if (upErr) {
      throw new BadRequestException(
        `Failed to upload packet: ${upErr.message}. Ensure bucket ${PACKET_BUCKET} exists.`,
      );
    }

    const { data: urlData } = client.storage.from(PACKET_BUCKET).getPublicUrl(filename);
    return {
      publicUrl: urlData.publicUrl,
      storagePath: filename,
      fileSize: pdfBuffer.length,
      generatedBy: userId,
      generatedAt: new Date().toISOString(),
    };
  }

  private async renderPacketPdf(ctx: {
    tenant: Record<string, unknown>;
    assessment: Record<string, unknown>;
    vehicle: Record<string, unknown>;
    customer: Record<string, unknown> | null;
  }): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const n = (v: unknown, dp = 2) => {
        const x = Number(v ?? 0);
        return Number.isFinite(x) ? x.toFixed(dp) : (0).toFixed(dp);
      };
      const s = (v: unknown) => (v == null ? '' : String(v));

      const findings = ((ctx.assessment.findings as Array<Record<string, unknown>>) ?? []);
      const operations = ((ctx.assessment.operations as Array<Record<string, unknown>>) ?? []);
      const photos = ((ctx.assessment.photos as Array<Record<string, unknown>>) ?? []);

      // ── Header ────────────────────────────────────────────────
      doc.fontSize(18).text('Damage Assessment', { align: 'left' });
      doc.moveDown(0.25);
      doc
        .fontSize(10)
        .fillColor('#555')
        .text(`Generated ${new Date().toLocaleString()}`);
      doc.fillColor('#000');
      if (ctx.tenant.name) {
        doc.moveDown(0.25).fontSize(10).text(s(ctx.tenant.name));
      }
      doc.moveDown();

      // ── Vehicle ───────────────────────────────────────────────
      doc.fontSize(12).text('Vehicle', { underline: true });
      doc
        .fontSize(10)
        .text(`Plate: ${s(ctx.vehicle.plate)}`)
        .text(
          `Make / Model: ${s(ctx.vehicle.make)} ${s(ctx.vehicle.model)}${ctx.vehicle.year ? ` (${s(ctx.vehicle.year)})` : ''}`,
        );
      if (ctx.vehicle.vin) doc.text(`VIN: ${s(ctx.vehicle.vin)}`);
      doc.moveDown(0.5);

      // ── Customer ──────────────────────────────────────────────
      if (ctx.customer) {
        doc.fontSize(12).text('Customer', { underline: true });
        doc.fontSize(10).text(`Name: ${s(ctx.customer.full_name)}`);
        if (ctx.customer.phone) doc.text(`Phone: ${s(ctx.customer.phone)}`);
        if (ctx.customer.tax_id) doc.text(`Tax ID: ${s(ctx.customer.tax_id)}`);
        doc.moveDown(0.5);
      }

      // ── Assessment meta ───────────────────────────────────────
      doc.fontSize(12).text('Assessment', { underline: true });
      doc
        .fontSize(10)
        .text(`Status: ${s(ctx.assessment.status)}`)
        .text(`Source: ${s(ctx.assessment.source)}`);
      if (ctx.assessment.analysed_at) {
        doc.text(`AI analysed: ${new Date(String(ctx.assessment.analysed_at)).toLocaleString()}`);
      }
      if (ctx.assessment.analysed_by_model) {
        doc.text(`Model: ${s(ctx.assessment.analysed_by_model)}`);
      }
      if (ctx.assessment.confidence_avg != null) {
        const c = Number(ctx.assessment.confidence_avg);
        doc.text(`Average confidence: ${Math.round(c * 100)}%`);
      }
      doc.moveDown();

      // ── Findings ──────────────────────────────────────────────
      if (findings.length > 0) {
        doc.fontSize(12).text('Findings', { underline: true });
        doc.fontSize(10);
        for (const f of findings) {
          const conf =
            f.confidence != null ? ` (${Math.round(Number(f.confidence) * 100)}%)` : '';
          const src =
            f.source === 'reviewer_override'
              ? ' [override]'
              : f.source === 'model'
                ? ' [AI]'
                : '';
          const notes = f.notes ? ` — ${s(f.notes)}` : '';
          doc.text(
            `• ${s(f.panel)} — ${s(f.damage_type)}, severity ${s(f.severity)}${conf}${src}${notes}`,
          );
        }
        doc.moveDown();
      }

      // ── Operations ────────────────────────────────────────────
      if (operations.length > 0) {
        doc.fontSize(12).text('Proposed operations', { underline: true });
        doc.fontSize(10);
        for (const o of operations) {
          const oem = o.oem_part_number ? ` [${s(o.oem_part_number)}]` : '';
          const src = o.source === 'reviewer_override' ? ' [override]' : o.source === 'model' ? ' [AI]' : '';
          doc.text(
            `• ${s(o.panel)} — ${s(o.operation)}${oem}: ${n(o.labour_hours)}h, parts ${n(o.parts_cost)}, paint ${n(o.paint_cost)}${src}`,
          );
        }
        doc.moveDown();
      }

      // ── Totals ────────────────────────────────────────────────
      doc.fontSize(12).text('Totals', { underline: true });
      doc
        .fontSize(10)
        .text(`Labour hours:     ${n(ctx.assessment.total_hours)}`)
        .text(`Parts cost:       ${n(ctx.assessment.total_parts_cost)}`)
        .text(`Paint cost:       ${n(ctx.assessment.total_paint_cost)}`)
        .fontSize(12)
        .text(`Estimate (parts + paint): ${n(ctx.assessment.total_estimate)}`);
      doc.fontSize(9).fillColor('#555').text(
        'Labour cost is calculated at the workshop’s hourly rate when the estimate is approved and pushed to a job card.',
      );
      doc.fillColor('#000');
      doc.moveDown();

      // ── Photos ────────────────────────────────────────────────
      if (photos.length > 0) {
        doc.addPage();
        doc.fontSize(12).text('Evidence photos', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10);
        for (const p of photos) {
          const url = s(p.public_url);
          const angle = p.view_angle ? `[${s(p.view_angle)}] ` : '';
          doc.text(`• ${angle}${url}`, { link: url });
        }
      }

      // ── Footer ────────────────────────────────────────────────
      doc.moveDown(2);
      doc
        .fontSize(8)
        .fillColor('#555')
        .text(
          'Generated by MECANIX. Damage-assessment summary from workshop-side evidence. Financial assessment only — not a statutory expertise report.',
          { align: 'left' },
        );

      doc.end();
    });
  }

  // ─── customer capture link ────────────────────────────────────
  // Workshop issues a tokenised URL; customer opens it, takes photos,
  // they land on the assessment. Token is single-per-assessment — reused
  // if still valid to keep the share link stable.
  async ensureCaptureToken(tenantId: string, assessmentId: string) {
    const client = this.supabase.getClient();
    const { data: existing } = await client
      .from('damage_assessments')
      .select('capture_token, capture_token_expires_at, status')
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId)
      .single();
    if (!existing) throw new NotFoundException('Assessment not found');
    if (existing.status === 'approved' || existing.status === 'rejected' || existing.status === 'cancelled') {
      throw new BadRequestException('Assessment is closed — cannot issue a new capture link');
    }

    const now = Date.now();
    const stillValid =
      existing.capture_token &&
      existing.capture_token_expires_at &&
      new Date(existing.capture_token_expires_at as string).getTime() > now;

    let token: string;
    let expiresAt: string;
    if (stillValid) {
      token = existing.capture_token as string;
      expiresAt = existing.capture_token_expires_at as string;
    } else {
      token = crypto.randomBytes(20).toString('hex');
      expiresAt = new Date(now + CAPTURE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await client
        .from('damage_assessments')
        .update({
          capture_token: token,
          capture_token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessmentId)
        .eq('tenant_id', tenantId);
    }

    const base = this.config.get<string>('PUBLIC_APP_URL', '');
    let url: string | null = null;
    if (base) {
      // Page lives at [locale]/public/aida/capture/[token] — next-intl's
      // default localePrefix is 'always', so an unprefixed URL 404s.
      // Use the tenant's configured locale; fall back to pt-PT.
      const { data: tenant } = await client
        .from('tenants')
        .select('locale')
        .eq('id', tenantId)
        .single();
      const locale = (tenant?.locale as string | null) ?? 'pt-PT';
      url = `${base.replace(/\/$/, '')}/${locale}/public/aida/capture/${token}`;
    }
    return { token, expiresAt, url };
  }

  // Public-facing getter — token in, sanitised summary out. No
  // tenant scoping: the token IS the authorisation.
  async getByCaptureToken(token: string) {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('damage_assessments')
      .select(
        'id, tenant_id, status, capture_token_expires_at, vehicle:vehicles(plate, make, model, year), tenant:tenants(name)',
      )
      .eq('capture_token', token)
      .limit(1)
      .maybeSingle();
    if (!data) throw new NotFoundException('Capture link not found');

    const expiresAt = data.capture_token_expires_at as string | null;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      throw new NotFoundException('Capture link has expired');
    }
    if (data.status === 'approved' || data.status === 'rejected' || data.status === 'cancelled') {
      throw new NotFoundException('This assessment is already closed');
    }

    const { count: photoCount } = await client
      .from('assessment_photos')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', data.tenant_id as string)
      .eq('assessment_id', data.id as string);

    const vehicle = Array.isArray(data.vehicle)
      ? (data.vehicle[0] as Record<string, unknown> | undefined)
      : (data.vehicle as Record<string, unknown> | null);
    const tenant = Array.isArray(data.tenant)
      ? (data.tenant[0] as Record<string, unknown> | undefined)
      : (data.tenant as Record<string, unknown> | null);

    return {
      id: data.id as string,
      status: data.status as string,
      expiresAt,
      vehicle: vehicle ?? null,
      tenantName: (tenant?.name as string | undefined) ?? null,
      photoCount: photoCount ?? 0,
    };
  }

  // Customer-side photo upload. Validates token, then reuses the
  // same compression + storage path as the workshop-side uploadPhoto.
  async uploadPhotoByToken(
    token: string,
    input: { file: string; filename: string; viewAngle?: string },
  ) {
    const client = this.supabase.getClient();
    const { data: assessment } = await client
      .from('damage_assessments')
      .select('id, tenant_id, status, capture_token_expires_at')
      .eq('capture_token', token)
      .limit(1)
      .maybeSingle();
    if (!assessment) throw new NotFoundException('Capture link not found');

    const expiresAt = assessment.capture_token_expires_at as string | null;
    if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Capture link has expired');
    }
    if (assessment.status === 'approved' || assessment.status === 'rejected' || assessment.status === 'cancelled') {
      throw new BadRequestException('Assessment is closed');
    }

    const tenantId = assessment.tenant_id as string;
    const assessmentId = assessment.id as string;

    const base64 = input.file.replace(/^data:image\/\w+;base64,/, '');
    const raw = Buffer.from(base64, 'base64');
    if (raw.length === 0) throw new BadRequestException('Empty image payload');

    const { buffer, width, height } = await compress(raw);
    const path = `${tenantId}/${assessmentId}/${Date.now()}-customer-${input.filename.replace(/[^\w.-]/g, '_')}.jpg`;

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
        width_px: width,
        height_px: height,
      })
      .select()
      .single();
    if (error) throw error;

    // Bump the assessment updated_at so the workshop UI reflects
    // the new customer upload.
    await client
      .from('damage_assessments')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', assessmentId)
      .eq('tenant_id', tenantId);

    return data;
  }

  // ─── observability / cost cap ─────────────────────────────────
  async getMonthlyStats(tenantId: string): Promise<{
    analysesThisMonth: number;
    monthlyAnalysesMax: number;
    totalAnalyses: number;
    avgConfidence: number | null;
    editRate: number | null;   // fraction 0-1; null if no model-sourced findings yet
  }> {
    const client = this.supabase.getClient();
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const { data: capSetting } = await client
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'aida.monthly_analyses_max')
      .maybeSingle();
    const monthlyAnalysesMax = (() => {
      const parsed = Number(capSetting?.value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
    })();

    const { count: analysesThisMonth } = await client
      .from('damage_assessments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('analysed_at', 'is', null)
      .gte('analysed_at', startOfMonth.toISOString());

    const { count: totalAnalyses } = await client
      .from('damage_assessments')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('analysed_at', 'is', null);

    const { data: confRows } = await client
      .from('damage_assessments')
      .select('confidence_avg')
      .eq('tenant_id', tenantId)
      .not('analysed_at', 'is', null)
      .not('confidence_avg', 'is', null);
    const confs = (confRows ?? [])
      .map((r) => Number((r as Record<string, unknown>).confidence_avg))
      .filter((n) => Number.isFinite(n));
    const avgConfidence =
      confs.length > 0 ? confs.reduce((s, n) => s + n, 0) / confs.length : null;

    const { count: modelFindings } = await client
      .from('assessment_findings')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .in('source', ['model', 'reviewer_override']);
    const { count: overriddenFindings } = await client
      .from('assessment_findings')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('source', 'reviewer_override');
    const editRate =
      (modelFindings ?? 0) > 0
        ? Math.min(1, (overriddenFindings ?? 0) / (modelFindings ?? 1))
        : null;

    return {
      analysesThisMonth: analysesThisMonth ?? 0,
      monthlyAnalysesMax,
      totalAnalyses: totalAnalyses ?? 0,
      avgConfidence,
      editRate,
    };
  }
}
