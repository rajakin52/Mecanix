import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class EstimatesService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(tenantId: string, claimId: string, userId: string) {
    const client = this.supabase.getClient();

    // 1. Get claim to find job_card_id
    const { data: claim, error: claimError } = await client
      .from('insurance_claims')
      .select('job_card_id')
      .eq('id', claimId)
      .eq('tenant_id', tenantId)
      .single();

    if (claimError || !claim) {
      throw new NotFoundException('Insurance claim not found');
    }

    const jobCardId = claim.job_card_id as string;

    // 2. Fetch labour lines from job card
    const { data: labourLines } = await client
      .from('labour_lines')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    // 3. Fetch parts lines from job card
    const { data: partsLines } = await client
      .from('parts_lines')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    // 4. Get current version count and increment
    const { count: versionCount } = await client
      .from('claim_estimates')
      .select('id', { count: 'exact', head: true })
      .eq('claim_id', claimId)
      .eq('tenant_id', tenantId);

    const version = (versionCount ?? 0) + 1;

    // 5. Calculate total
    const labourTotal = (labourLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );
    const partsTotal = (partsLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );
    const total = Math.round((labourTotal + partsTotal) * 100) / 100;

    // 6. Insert claim_estimate
    const { data: estimate, error: estimateError } = await client
      .from('claim_estimates')
      .insert({
        tenant_id: tenantId,
        claim_id: claimId,
        version,
        total,
        status: 'pending',
        created_by: userId,
      })
      .select()
      .single();

    if (estimateError) throw estimateError;

    // 7. Insert estimate lines for labour
    const estimateLines: Record<string, unknown>[] = [];

    for (const line of labourLines ?? []) {
      estimateLines.push({
        estimate_id: estimate.id,
        tenant_id: tenantId,
        type: 'labour',
        description: line.description,
        quantity: line.hours ?? 1,
        unit_price: line.rate ?? 0,
        subtotal: line.subtotal ?? 0,
        assessor_status: 'pending',
      });
    }

    // Insert estimate lines for parts
    for (const line of partsLines ?? []) {
      estimateLines.push({
        estimate_id: estimate.id,
        tenant_id: tenantId,
        type: 'parts',
        description: line.part_name,
        quantity: line.quantity ?? 1,
        unit_price: line.unit_cost ?? 0,
        subtotal: line.subtotal ?? 0,
        assessor_status: 'pending',
      });
    }

    if (estimateLines.length > 0) {
      const { error: linesError } = await client
        .from('claim_estimate_lines')
        .insert(estimateLines);

      if (linesError) throw linesError;
    }

    // 8. Update claim workshop_estimate
    await client
      .from('insurance_claims')
      .update({ workshop_estimate: total })
      .eq('id', claimId)
      .eq('tenant_id', tenantId);

    // 9. Return estimate with lines
    return this.getById(tenantId, estimate.id);
  }

  async getById(tenantId: string, estimateId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('claim_estimates')
      .select('*, lines:claim_estimate_lines(*)')
      .eq('id', estimateId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Estimate not found');
    }

    return data;
  }

  async reviewLine(
    tenantId: string,
    lineId: string,
    assessorStatus: string,
    assessorPrice?: number,
    assessorComment?: string,
  ) {
    const client = this.supabase.getClient();

    // Verify line exists
    const { data: line, error: lineError } = await client
      .from('claim_estimate_lines')
      .select('*, estimate:claim_estimates(id, tenant_id, claim_id)')
      .eq('id', lineId)
      .eq('tenant_id', tenantId)
      .single();

    if (lineError || !line) {
      throw new NotFoundException('Estimate line not found');
    }

    const updateData: Record<string, unknown> = {
      assessor_status: assessorStatus,
    };

    if (assessorPrice !== undefined) {
      updateData['assessor_price'] = assessorPrice;
    }
    if (assessorComment !== undefined) {
      updateData['assessor_comment'] = assessorComment;
    }

    const { data, error } = await client
      .from('claim_estimate_lines')
      .update(updateData)
      .eq('id', lineId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Recalculate estimate total based on approved/adjusted prices
    const estimateId = (line.estimate as { id: string }).id;
    await this.recalculateEstimateTotal(tenantId, estimateId);

    return data;
  }

  async approveEstimate(
    tenantId: string,
    estimateId: string,
    assessorName: string,
    notes?: string,
  ) {
    const client = this.supabase.getClient();

    const estimate = await this.getById(tenantId, estimateId);

    // Calculate approved amount from approved/adjusted lines
    const lines = (estimate.lines ?? []) as Array<{
      assessor_status: string;
      assessor_price?: number;
      subtotal: number;
    }>;

    let approvedAmount = 0;
    for (const line of lines) {
      if (line.assessor_status === 'approved') {
        approvedAmount += line.subtotal || 0;
      } else if (line.assessor_status === 'adjusted' && line.assessor_price != null) {
        approvedAmount += line.assessor_price;
      }
    }

    approvedAmount = Math.round(approvedAmount * 100) / 100;

    // Update estimate status
    const { error: estError } = await client
      .from('claim_estimates')
      .update({ status: 'approved', approved_amount: approvedAmount })
      .eq('id', estimateId)
      .eq('tenant_id', tenantId);

    if (estError) throw estError;

    // Update claim approved_amount
    const claimId = estimate.claim_id as string;
    await client
      .from('insurance_claims')
      .update({ approved_amount: approvedAmount })
      .eq('id', claimId)
      .eq('tenant_id', tenantId);

    // Insert assessor action
    await client.from('assessor_actions').insert({
      claim_id: claimId,
      action: 'estimate_approved',
      assessor_name: assessorName,
      notes: notes || null,
    });

    return this.getById(tenantId, estimateId);
  }

  async rejectEstimate(
    tenantId: string,
    estimateId: string,
    assessorName: string,
    notes?: string,
  ) {
    const client = this.supabase.getClient();

    const estimate = await this.getById(tenantId, estimateId);

    // Update estimate status
    const { error: estError } = await client
      .from('claim_estimates')
      .update({ status: 'rejected' })
      .eq('id', estimateId)
      .eq('tenant_id', tenantId);

    if (estError) throw estError;

    // Insert assessor action
    const claimId = estimate.claim_id as string;
    await client.from('assessor_actions').insert({
      claim_id: claimId,
      action: 'estimate_rejected',
      assessor_name: assessorName,
      notes: notes || null,
    });

    return this.getById(tenantId, estimateId);
  }

  async createSupplement(tenantId: string, claimId: string, userId: string, reason: string) {
    const client = this.supabase.getClient();

    // 1. Get claim to find job_card_id
    const { data: claim, error: claimError } = await client
      .from('insurance_claims')
      .select('job_card_id')
      .eq('id', claimId)
      .eq('tenant_id', tenantId)
      .single();

    if (claimError || !claim) {
      throw new NotFoundException('Insurance claim not found');
    }

    const jobCardId = claim.job_card_id as string;

    // 2. Fetch labour lines from job card
    const { data: labourLines } = await client
      .from('labour_lines')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    // 3. Fetch parts lines from job card
    const { data: partsLines } = await client
      .from('parts_lines')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('sort_order', { ascending: true });

    // 4. Get current version count and increment
    const { count: versionCount } = await client
      .from('claim_estimates')
      .select('id', { count: 'exact', head: true })
      .eq('claim_id', claimId)
      .eq('tenant_id', tenantId);

    const version = (versionCount ?? 0) + 1;

    // 5. Calculate total
    const labourTotal = (labourLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );
    const partsTotal = (partsLines ?? []).reduce(
      (sum: number, line: { subtotal: number }) => sum + (line.subtotal || 0),
      0,
    );
    const total = Math.round((labourTotal + partsTotal) * 100) / 100;

    // 6. Insert claim_estimate marked as supplement
    const { data: estimate, error: estimateError } = await client
      .from('claim_estimates')
      .insert({
        tenant_id: tenantId,
        claim_id: claimId,
        version,
        total,
        status: 'pending',
        is_supplement: true,
        supplement_reason: reason,
        created_by: userId,
      })
      .select()
      .single();

    if (estimateError) throw estimateError;

    // 7. Insert estimate lines
    const estimateLines: Record<string, unknown>[] = [];

    for (const line of labourLines ?? []) {
      estimateLines.push({
        estimate_id: estimate.id,
        tenant_id: tenantId,
        type: 'labour',
        description: line.description,
        quantity: line.hours ?? 1,
        unit_price: line.rate ?? 0,
        subtotal: line.subtotal ?? 0,
        assessor_status: 'pending',
      });
    }

    for (const line of partsLines ?? []) {
      estimateLines.push({
        estimate_id: estimate.id,
        tenant_id: tenantId,
        type: 'parts',
        description: line.part_name,
        quantity: line.quantity ?? 1,
        unit_price: line.unit_cost ?? 0,
        subtotal: line.subtotal ?? 0,
        assessor_status: 'pending',
      });
    }

    if (estimateLines.length > 0) {
      const { error: linesError } = await client
        .from('claim_estimate_lines')
        .insert(estimateLines);

      if (linesError) throw linesError;
    }

    // 8. Update claim workshop_estimate (sum of all estimates)
    const { data: allEstimates } = await client
      .from('claim_estimates')
      .select('total')
      .eq('claim_id', claimId)
      .eq('tenant_id', tenantId);

    const combinedTotal = (allEstimates ?? []).reduce(
      (sum: number, e: { total: number }) => sum + (e.total || 0),
      0,
    );

    await client
      .from('insurance_claims')
      .update({ workshop_estimate: Math.round(combinedTotal * 100) / 100 })
      .eq('id', claimId)
      .eq('tenant_id', tenantId);

    return this.getById(tenantId, estimate.id);
  }

  private async recalculateEstimateTotal(tenantId: string, estimateId: string) {
    const client = this.supabase.getClient();

    const { data: lines, error } = await client
      .from('claim_estimate_lines')
      .select('assessor_status, assessor_price, subtotal')
      .eq('estimate_id', estimateId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    let total = 0;
    for (const line of lines ?? []) {
      if (line.assessor_status === 'rejected') {
        continue;
      } else if (line.assessor_status === 'adjusted' && line.assessor_price != null) {
        total += line.assessor_price;
      } else {
        total += line.subtotal || 0;
      }
    }

    total = Math.round(total * 100) / 100;

    await client
      .from('claim_estimates')
      .update({ total })
      .eq('id', estimateId)
      .eq('tenant_id', tenantId);
  }
}
