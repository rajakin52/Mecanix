import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import * as crypto from 'crypto';

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

  // ── DVI-to-Estimate Auto-Conversion ────────────────────────

  /**
   * Auto-create job card lines from red DVI items by matching against repair catalog.
   * Yellow items are deferred for follow-up.
   */
  async autoConvertDviToLines(
    tenantId: string,
    jobCardId: string,
    inspectionId: string,
  ) {
    const client = this.supabase.getClient();

    // Get DVI items
    const { data: dviItems } = await client
      .from('inspection_items')
      .select('*')
      .eq('inspection_id', inspectionId)
      .eq('tenant_id', tenantId)
      .order('sort_order');

    if (!dviItems || dviItems.length === 0) return { converted: 0, deferred: 0 };

    const redItems = dviItems.filter((i) => i.status === 'red');
    const yellowItems = dviItems.filter((i) => i.status === 'yellow');

    // Get repair catalog for matching
    const { data: catalogItems } = await client
      .from('repair_catalog')
      .select('*, labour_items:repair_catalog_labour_items(*), parts_items:repair_catalog_parts_items(*)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    const catalog = catalogItems ?? [];

    let convertedCount = 0;

    for (const item of redItems) {
      const itemName = (item.name as string).toLowerCase();
      const itemCategory = (item.category as string).toLowerCase();

      // Try to match against catalog by name or category
      const match = catalog.find((c) => {
        const cName = (c.name as string).toLowerCase();
        const cCategory = ((c.category as string) ?? '').toLowerCase();
        return cName.includes(itemName) || itemName.includes(cName) ||
               (cCategory && cCategory === itemCategory);
      });

      if (match) {
        // Apply catalog item's labour lines
        const labourItems = (match.labour_items ?? []) as Array<Record<string, unknown>>;
        for (const li of labourItems) {
          await client.from('labour_lines').insert({
            tenant_id: tenantId,
            job_card_id: jobCardId,
            description: `${li.description} (DVI: ${item.name})`,
            hours: Number(li.hours) || 1,
            rate: Number(li.rate) || 0,
            subtotal: Math.round((Number(li.hours) || 1) * (Number(li.rate) || 0) * 100) / 100,
          });
        }

        // Apply catalog item's parts lines
        const partsItems = (match.parts_items ?? []) as Array<Record<string, unknown>>;
        for (const pi of partsItems) {
          const qty = Number(pi.quantity) || 1;
          const cost = Number(pi.unit_cost) || 0;
          const markup = Number(pi.markup_pct) || 0;
          const sellPrice = Math.round(cost * (1 + markup / 100) * 100) / 100;
          await client.from('parts_lines').insert({
            tenant_id: tenantId,
            job_card_id: jobCardId,
            part_name: pi.part_name,
            part_number: pi.part_number || null,
            quantity: qty,
            unit_cost: cost,
            markup_pct: markup,
            sell_price: sellPrice,
            subtotal: Math.round(qty * sellPrice * 100) / 100,
          });
        }

        convertedCount++;
      } else {
        // No catalog match — create a generic labour line
        await client.from('labour_lines').insert({
          tenant_id: tenantId,
          job_card_id: jobCardId,
          description: `${item.name}${item.recommendation ? ` — ${item.recommendation}` : ''}`,
          hours: 1,
          rate: 0,
          subtotal: 0,
        });
        convertedCount++;
      }
    }

    return { converted: convertedCount, deferred: yellowItems.length, redCount: redItems.length };
  }

  // ── Public Token-Based Access ─────────────────────────────

  private readonly TOKEN_SECRET = process.env['SUPABASE_SERVICE_ROLE_KEY']?.slice(0, 32) ?? 'mecanix-estimate-token-secret-key';

  /**
   * Generate a signed token for public estimate access (7 days validity).
   */
  generatePublicToken(estimateId: string): string {
    const payload = `${estimateId}:${Date.now() + 7 * 24 * 60 * 60 * 1000}`;
    const hmac = crypto.createHmac('sha256', this.TOKEN_SECRET).update(payload).digest('hex');
    const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');
    return token;
  }

  /**
   * Validate a public token and return the estimate ID.
   */
  validatePublicToken(token: string): string | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const parts = decoded.split(':');
      if (parts.length !== 3) return null;

      const [estimateId, expiryStr, providedHmac] = parts;
      const expiry = Number(expiryStr);

      if (Date.now() > expiry) return null; // Expired

      const expectedHmac = crypto
        .createHmac('sha256', this.TOKEN_SECRET)
        .update(`${estimateId}:${expiryStr}`)
        .digest('hex');

      if (providedHmac !== expectedHmac) return null; // Tampered

      return estimateId!;
    } catch {
      return null;
    }
  }

  /**
   * Get estimate data for public display (no tenant check — token-validated).
   */
  async getPublicEstimate(estimateId: string) {
    const client = this.supabase.getClient();

    const { data: estimate } = await client
      .from('estimates')
      .select('*')
      .eq('id', estimateId)
      .single();

    if (!estimate) throw new NotFoundException('Estimate not found');

    // Get job card with customer/vehicle info
    const { data: job } = await client
      .from('job_cards')
      .select('*, customer:customers(full_name, phone, email), vehicle:vehicles(plate, make, model, year)')
      .eq('id', estimate.job_card_id)
      .single();

    // Get tenant info
    const { data: tenant } = await client
      .from('tenants')
      .select('name, phone, email, address, tax_id')
      .eq('id', estimate.tenant_id)
      .single();

    return {
      estimate,
      customer: (job as Record<string, unknown>)?.customer ?? null,
      vehicle: (job as Record<string, unknown>)?.vehicle ?? null,
      workshop: tenant,
    };
  }

  /**
   * Approve via public token (no auth required).
   */
  async approvePublic(estimateId: string, input?: { notes?: string }) {
    const { data: estimate } = await this.supabase
      .getClient()
      .from('estimates')
      .select('status, tenant_id, job_card_id')
      .eq('id', estimateId)
      .single();

    if (!estimate) throw new NotFoundException('Estimate not found');
    if (estimate.status !== 'sent' && estimate.status !== 'draft') {
      throw new BadRequestException('Estimate is no longer available for approval');
    }

    await this.supabase
      .getClient()
      .from('estimates')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approval_method: 'public_link',
        approval_notes: input?.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', estimateId);

    // Transition job
    const { data: job } = await this.supabase
      .getClient()
      .from('job_cards')
      .select('status')
      .eq('id', estimate.job_card_id)
      .single();

    if (job && ['awaiting_approval', 'awaiting_reapproval'].includes(job.status as string)) {
      await this.supabase
        .getClient()
        .from('job_cards')
        .update({ status: 'in_progress' })
        .eq('id', estimate.job_card_id);
    }

    return { approved: true };
  }

  /**
   * Reject via public token.
   */
  async rejectPublic(estimateId: string, input?: { notes?: string }) {
    await this.supabase
      .getClient()
      .from('estimates')
      .update({
        status: 'rejected',
        rejected_at: new Date().toISOString(),
        approval_notes: input?.notes ?? 'Rejected via link',
        updated_at: new Date().toISOString(),
      })
      .eq('id', estimateId);

    return { rejected: true };
  }
}
