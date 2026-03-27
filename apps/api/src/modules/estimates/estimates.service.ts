import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class EstimatesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listByJob(tenantId: string, jobCardId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('estimates')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('version', { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('estimates')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Estimate not found');
    return data;
  }

  /**
   * Create estimate — snapshot current job card lines into an immutable estimate.
   */
  async create(tenantId: string, userId: string, jobCardId: string, input?: { terms?: string; validUntil?: string }) {
    const client = this.supabase.getClient();

    // Get job card
    const { data: job } = await client
      .from('job_cards')
      .select('*')
      .eq('id', jobCardId)
      .eq('tenant_id', tenantId)
      .single();

    if (!job) throw new NotFoundException('Job card not found');

    // Get labour lines
    const { data: labourLines } = await client
      .from('labour_lines')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('sort_order');

    // Get parts lines
    const { data: partsLines } = await client
      .from('parts_lines')
      .select('*')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('sort_order');

    // Get DVI items if inspection exists
    let dviSnapshot = null;
    const { data: inspection } = await client
      .from('vehicle_inspections')
      .select('id')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (inspection) {
      const { data: dviItems } = await client
        .from('inspection_items')
        .select('*')
        .eq('inspection_id', inspection.id)
        .eq('tenant_id', tenantId)
        .order('sort_order');
      dviSnapshot = dviItems ?? [];
    }

    // Calculate totals
    const labourTotal = (labourLines ?? []).reduce(
      (sum: number, l: Record<string, unknown>) => sum + (Number(l.subtotal) || 0), 0,
    );
    const partsTotal = (partsLines ?? []).reduce(
      (sum: number, l: Record<string, unknown>) => sum + (Number(l.subtotal) || 0), 0,
    );

    // Get tax rate
    const { data: taxSetting } = await client
      .from('tenant_settings')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', 'tax_rate')
      .maybeSingle();

    const taxRate = taxSetting?.value ? Number(taxSetting.value) : 14;
    const subtotal = labourTotal + partsTotal;
    const taxAmount = job.is_taxable !== false ? subtotal * (taxRate / 100) : 0;
    const grandTotal = subtotal + taxAmount;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    // Check for existing estimates to determine version
    const { data: existing } = await client
      .from('estimates')
      .select('version')
      .eq('job_card_id', jobCardId)
      .eq('tenant_id', tenantId)
      .order('version', { ascending: false })
      .limit(1);

    const prevVersion = existing?.[0]?.version;
    const version = prevVersion != null ? (Number(prevVersion) + 1) : 1;
    const isRevision = version > 1;

    // Supersede previous estimate
    if (isRevision) {
      await client
        .from('estimates')
        .update({ status: 'superseded', updated_at: new Date().toISOString() })
        .eq('job_card_id', jobCardId)
        .eq('tenant_id', tenantId)
        .neq('status', 'superseded');
    }

    // Generate estimate number
    const { data: estNumber } = await client.rpc('generate_estimate_number', { p_tenant_id: tenantId });

    // Build change summary for revisions
    let changeSummary: string | null = null;
    if (isRevision && existing && existing.length > 0) {
      // Get the previous estimate's totals for comparison
      const { data: prev } = await client
        .from('estimates')
        .select('grand_total')
        .eq('job_card_id', jobCardId)
        .eq('tenant_id', tenantId)
        .eq('status', 'superseded')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prev) {
        const diff = round2(grandTotal) - Number(prev.grand_total);
        changeSummary = diff >= 0
          ? `Total increased by ${diff.toFixed(2)} (from ${Number(prev.grand_total).toFixed(2)} to ${round2(grandTotal).toFixed(2)})`
          : `Total decreased by ${Math.abs(diff).toFixed(2)} (from ${Number(prev.grand_total).toFixed(2)} to ${round2(grandTotal).toFixed(2)})`;
      }
    }

    // Insert estimate
    const { data: estimate, error } = await client
      .from('estimates')
      .insert({
        tenant_id: tenantId,
        job_card_id: jobCardId,
        estimate_number: estNumber,
        version,
        status: 'draft',
        labour_total: round2(labourTotal),
        parts_total: round2(partsTotal),
        tax_rate: taxRate,
        tax_amount: round2(taxAmount),
        grand_total: round2(grandTotal),
        labour_lines_snapshot: labourLines ?? [],
        parts_lines_snapshot: partsLines ?? [],
        dvi_snapshot: dviSnapshot,
        is_revision: isRevision,
        change_summary: changeSummary,
        terms: input?.terms ?? null,
        valid_until: input?.validUntil ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;

    // Update job card with current estimate
    await client
      .from('job_cards')
      .update({ current_estimate_id: estimate.id })
      .eq('id', jobCardId)
      .eq('tenant_id', tenantId);

    return estimate;
  }

  /**
   * Mark estimate as sent.
   */
  async markSent(tenantId: string, id: string, channels: string[]) {
    const { data, error } = await this.supabase
      .getClient()
      .from('estimates')
      .update({
        status: 'sent',
        approval_channels: channels,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Log delivery per channel
    for (const channel of channels) {
      await this.supabase
        .getClient()
        .from('estimate_delivery_log')
        .insert({
          tenant_id: tenantId,
          estimate_id: id,
          channel,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });
    }

    return data;
  }

  /**
   * Approve estimate.
   */
  async approve(tenantId: string, id: string, input?: { notes?: string; signatureUrl?: string; method?: string }) {
    const estimate = await this.getById(tenantId, id);

    if (estimate.status !== 'sent' && estimate.status !== 'draft') {
      throw new BadRequestException('Estimate can only be approved when in draft or sent status');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('estimates')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approval_method: input?.method ?? 'manual',
        approval_notes: input?.notes ?? null,
        signature_url: input?.signatureUrl ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Transition job to in_progress if it was awaiting approval
    const { data: job } = await this.supabase
      .getClient()
      .from('job_cards')
      .select('status')
      .eq('id', estimate.job_card_id)
      .eq('tenant_id', tenantId)
      .single();

    if (job && (job.status === 'awaiting_approval' || job.status === 'awaiting_reapproval')) {
      await this.supabase
        .getClient()
        .from('job_cards')
        .update({ status: 'in_progress' })
        .eq('id', estimate.job_card_id)
        .eq('tenant_id', tenantId);

      await this.supabase
        .getClient()
        .from('job_status_history')
        .insert({
          tenant_id: tenantId,
          job_card_id: estimate.job_card_id,
          from_status: job.status,
          to_status: 'in_progress',
          changed_by: null,
          notes: `Estimate ${estimate.estimate_number} approved`,
        });
    }

    return data;
  }

  /**
   * Reject estimate.
   */
  async reject(tenantId: string, id: string, input?: { notes?: string }) {
    const estimate = await this.getById(tenantId, id);

    const { data, error } = await this.supabase
      .getClient()
      .from('estimates')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        approval_notes: input?.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
