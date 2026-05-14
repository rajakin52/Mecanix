import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { JobsService } from './jobs.service';
import { InspectionsService } from '../inspections/inspections.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateLabourLineInput, UpdateLabourLineInput } from '@mecanix/validators';

@Injectable()
export class LabourLinesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly jobsService: JobsService,
    private readonly inspectionsService: InspectionsService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Resolve labour cost-per-hour for a technician (column added in
   * migration 00110). Falls back to 0 when the column isn't set —
   * margin snapshot will then be null and the UI hides the badge.
   */
  private async getTechnicianCostPerHour(
    tenantId: string,
    technicianId: string,
  ): Promise<number> {
    const { data } = await this.supabase
      .getClient()
      .from('technicians')
      .select('cost_per_hour')
      .eq('id', technicianId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    return Number(data?.cost_per_hour ?? 0);
  }

  /** Refuse to mutate a line that's already been billed on an invoice. */
  private assertNotBilled(line: Record<string, unknown>): void {
    if (line['billed_on_invoice_id']) {
      throw new BadRequestException(
        'This labour line has already been billed on an invoice and cannot be edited. Issue a credit note + a replacement line instead.',
      );
    }
  }

  async list(tenantId: string, jobCardId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('labour_lines')
      .select('*, technician:technicians(id, full_name), tax_code:tax_codes(id, code, rate)')
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
    // Closed-card gate: invoiced cards are read-only until reopened.
    await this.jobsService.assertNotInvoiced(tenantId, jobCardId);
    // Require vehicle inspection before adding work items
    await this.inspectionsService.requireInspection(tenantId, jobCardId);

    const subtotal = Math.round(input.hours * input.rate * 100) / 100;

    // Snapshot the chosen (or tenant-default) tax code onto the line so
    // later rate edits never rewrite historical invoices. Labour is
    // always considered a "service" for retention purposes (see Código
    // do Imposto Industrial, retenção sobre prestação de serviços).
    let taxCodeId: string | null = null;
    let taxRate: number | null = null;

    if (input.taxCodeId) {
      const { data: chosen, error: chosenErr } = await this.supabase
        .getClient()
        .from('tax_codes')
        .select('id, rate')
        .eq('id', input.taxCodeId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();
      if (chosenErr || !chosen) throw new BadRequestException('Invalid tax code');
      taxCodeId = chosen.id as string;
      taxRate = Number(chosen.rate);
    } else {
      const { data: defaultTax } = await this.supabase
        .getClient()
        .from('tax_codes')
        .select('id, rate')
        .eq('tenant_id', tenantId)
        .eq('is_default', true)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      taxCodeId = (defaultTax?.id as string | undefined) ?? null;
      taxRate = defaultTax?.rate != null ? Number(defaultTax.rate) : null;
    }

    // Pricing-decision snapshot: labour has no cost-layer ledger (no
    // analogue of FIFO/LIFO/WAC for hours), so cost_method isn't stored.
    // sell_price_source is 'manual' — labour rates are nearly always
    // entered by hand by the receptionist. margin_pct_at_issue uses the
    // technician's cost_per_hour when known.
    let marginAtIssue: number | null = null;
    if (input.technicianId && input.rate > 0) {
      const costPerHour = await this.getTechnicianCostPerHour(tenantId, input.technicianId);
      if (costPerHour > 0) {
        marginAtIssue = Math.round(((input.rate - costPerHour) / input.rate) * 100000) / 1000;
      }
    }

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
        tax_code_id: taxCodeId,
        tax_rate: taxRate,
        warranty_months: input.warrantyMonths ?? null,
        warranty_km: input.warrantyKm ?? null,
        warranty_starts_at:
          input.warrantyMonths != null || input.warrantyKm != null ? new Date().toISOString() : null,
        labour_type: input.labourType ?? 'mechanical',
        sell_price_source: 'manual',
        margin_pct_at_issue: marginAtIssue,
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

    // Frozen-line gate: previously-billed lines are immutable regardless
    // of JC status (so post-reopen edits can't poison an issued invoice).
    this.assertNotBilled(existing);
    // Closed-card gate
    await this.jobsService.assertNotInvoiced(tenantId, existing.job_card_id as string);

    const hours = input.hours ?? existing.hours;
    const rate = input.rate ?? existing.rate;
    const subtotal = Math.round(hours * rate * 100) / 100;

    // Audit-trail before-state snapshot.
    const beforeAudit = {
      hours: Number(existing.hours),
      rate: Number(existing.rate),
      subtotal: Number(existing.subtotal),
      description: String(existing.description ?? ''),
      technician_id: (existing.technician_id as string | null) ?? null,
      labour_type: (existing.labour_type as string | null) ?? null,
      discount_pct: Number(existing.discount_pct ?? 0),
      discount_amount: Number(existing.discount_amount ?? 0),
    };

    const updateData: Record<string, unknown> = {
      subtotal,
    };

    if (input.description !== undefined) updateData['description'] = input.description;
    if (input.hours !== undefined) updateData['hours'] = input.hours;
    if (input.rate !== undefined) updateData['rate'] = input.rate;
    if (input.technicianId !== undefined) updateData['technician_id'] = input.technicianId || null;
    if (input.labourType !== undefined) updateData['labour_type'] = input.labourType;

    if (input.warrantyMonths !== undefined || input.warrantyKm !== undefined) {
      if (input.warrantyMonths !== undefined) updateData['warranty_months'] = input.warrantyMonths ?? null;
      if (input.warrantyKm !== undefined) updateData['warranty_km'] = input.warrantyKm ?? null;
      if (!existing.warranty_starts_at) {
        updateData['warranty_starts_at'] = new Date().toISOString();
      }
    }

    if (input.taxCodeId !== undefined) {
      const { data: tc, error: tcErr } = await this.supabase
        .getClient()
        .from('tax_codes')
        .select('id, rate')
        .eq('id', input.taxCodeId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();
      if (tcErr || !tc) throw new BadRequestException('Invalid tax code');
      updateData['tax_code_id'] = tc.id;
      updateData['tax_rate'] = tc.rate;
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('labour_lines')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;

    // Audit-trail after-state snapshot + write the diff. Skip if nothing
    // pricing-relevant moved.
    const afterAudit = {
      hours: Number(data.hours),
      rate: Number(data.rate),
      subtotal: Number(data.subtotal),
      description: String(data.description ?? ''),
      technician_id: (data.technician_id as string | null) ?? null,
      labour_type: (data.labour_type as string | null) ?? null,
      discount_pct: Number(data.discount_pct ?? 0),
      discount_amount: Number(data.discount_amount ?? 0),
    };
    const changedFields = (Object.keys(beforeAudit) as Array<keyof typeof beforeAudit>).filter(
      (k) => beforeAudit[k] !== afterAudit[k],
    );
    if (changedFields.length > 0) {
      await this.auditLog.record(tenantId, userId, null, {
        action: 'labour_line.updated',
        entityType: 'labour_line',
        entityId: id,
        summary: `Labour line updated — fields: ${changedFields.join(', ')}`,
        beforeState: beforeAudit,
        afterState: afterAudit,
        metadata: {
          job_card_id: existing.job_card_id,
          changed_fields: changedFields,
        },
      });
    }

    await this.jobsService.recalculateTotals(tenantId, existing.job_card_id);

    return data;
  }

  async delete(tenantId: string, id: string, jobCardId: string) {
    // Frozen-line gate first — we need the row to check it.
    const { data: existing } = await this.supabase
      .getClient()
      .from('labour_lines')
      .select('billed_on_invoice_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (existing) this.assertNotBilled(existing);
    await this.jobsService.assertNotInvoiced(tenantId, jobCardId);
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

    // Closed-card gate
    await this.jobsService.assertNotInvoiced(tenantId, line.job_card_id);
    // Inspection gate — cannot charge without inspection
    await this.inspectionsService.requireInspection(tenantId, line.job_card_id);

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
