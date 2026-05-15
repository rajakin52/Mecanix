import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { CreateCreditNoteInput } from '@mecanix/validators';

@Injectable()
export class CreditNotesService {
  private readonly logger = new Logger(CreditNotesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly audit: AuditLogService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    invoiceId: string,
    input: CreateCreditNoteInput,
  ) {
    const client = this.supabase.getClient();

    // Verify invoice exists
    const { data: invoice, error: invError } = await client
      .from('invoices')
      .select('id, balance_due')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)

      .single();

    if (invError || !invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // 1. Generate credit note number via RPC
    const { data: creditNoteNumber, error: rpcError } = await client.rpc(
      'generate_credit_note_number',
      { p_tenant_id: tenantId },
    );

    if (rpcError) throw rpcError;

    // 2. Insert credit note
    const { data: creditNote, error: cnError } = await client
      .from('credit_notes')
      .insert({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        credit_note_number: creditNoteNumber,
        amount: input.amount,
        reason: input.reason,
        created_by: userId,
      })
      .select()
      .single();

    if (cnError) throw cnError;

    // 3. Adjust invoice balance_due
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const currentBalance = (invoice.balance_due as number) || 0;
    const newBalance = round2(currentBalance - input.amount);

    const updateData: Record<string, unknown> = {
      balance_due: Math.max(newBalance, 0),

    };

    // 4. If balance_due <= 0, mark as paid
    if (newBalance <= 0) {
      updateData.status = 'paid';
    }

    const { error: updateError } = await client
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    await this.audit.record(tenantId, userId, null, {
      action: 'credit_note.issued',
      entityType: 'credit_note',
      entityId: creditNote.id as string,
      summary: `Credit note ${creditNoteNumber} issued for ${input.amount}`,
      metadata: {
        credit_note_number: creditNoteNumber,
        invoice_id: invoiceId,
        amount: input.amount,
        reason: input.reason,
      },
    });

    return creditNote;
  }

  async listByInvoice(tenantId: string, invoiceId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('credit_notes')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data ?? [];
  }

  /**
   * Credit-and-rebill: full-value credit note + clone the billed lines
   * back onto the job card so the user can edit and re-issue.
   *
   * The flow is:
   *   1. Issue NC for invoice.grand_total (zero the balance, status='paid').
   *   2. Clone every parts_line / labour_line where billed_on_invoice_id
   *      = this invoice — new rows on the same JC, billed_on_invoice_id
   *      cleared so they're eligible for the next invoice.
   *   3. Flip the JC back to in_progress + write a status-history row.
   *
   * The original invoice and its lines are NOT mutated — they stay as
   * the historical fiscal record (FT). The credit note (NC) is the
   * reversal. Together they form the AGT-compatible audit trail.
   *
   * Standalone (OTC) invoices cannot be credit-and-rebilled — they
   * have no JC to clone lines back to. Caller should issue a partial
   * credit note instead.
   */
  async creditAndRebill(
    tenantId: string,
    userId: string,
    invoiceId: string,
    reason: string,
  ) {
    const client = this.supabase.getClient();

    // 1. Verify invoice + preconditions
    const { data: invoice, error: invErr } = await client
      .from('invoices')
      .select('id, job_card_id, grand_total, invoice_number, status')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();
    if (invErr || !invoice) throw new NotFoundException('Invoice not found');
    if (!invoice.job_card_id) {
      throw new BadRequestException(
        'Standalone invoices cannot be credit-and-rebilled. Issue a credit note manually.',
      );
    }
    if (invoice.status === 'cancelled' || invoice.status === 'draft') {
      throw new BadRequestException(
        `Cannot credit-and-rebill an invoice in '${invoice.status}' status`,
      );
    }
    const fullAmount = Number(invoice.grand_total) || 0;
    if (fullAmount <= 0) {
      throw new BadRequestException('Invoice has zero value; nothing to credit.');
    }

    // 2. Issue credit note (reuses create() — fiscal trail, balance zero-out)
    const creditNote = await this.create(tenantId, userId, invoiceId, {
      amount: fullAmount,
      reason: `Credit-and-rebill: ${reason}`,
    });

    // 3. Clone parts_lines that were billed on this invoice. We strip
    // identifiers / timestamps / the billing back-references; everything
    // else (warehouse, costing snapshot, stock_status) is preserved so
    // (a) the new line carries the same audit data and (b) parts that
    // already had stock_status='issued' don't get re-deducted on the
    // next invoice.
    const { data: partsLines } = await client
      .from('parts_lines')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('billed_on_invoice_id', invoiceId);

    let clonedPartsCount = 0;
    if (partsLines && partsLines.length > 0) {
      const clones = partsLines.map((row) => {
        const r = row as Record<string, unknown>;
        const {
          id: _id,
          created_at: _created,
          updated_at: _updated,
          billed_on_invoice_id: _billed,
          invoice_id: _invId,
          ...rest
        } = r;
        return { ...rest, created_by: userId };
      });
      const { error: insErr } = await client.from('parts_lines').insert(clones);
      if (insErr) {
        this.logger.error(
          `creditAndRebill: failed to clone parts_lines for invoice ${invoiceId}: ${insErr.message}`,
        );
      } else {
        clonedPartsCount = clones.length;
      }
    }

    // 4. Clone labour_lines that were billed on this invoice.
    const { data: labourLines } = await client
      .from('labour_lines')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('billed_on_invoice_id', invoiceId);

    let clonedLabourCount = 0;
    if (labourLines && labourLines.length > 0) {
      const clones = labourLines.map((row) => {
        const r = row as Record<string, unknown>;
        const {
          id: _id,
          created_at: _created,
          updated_at: _updated,
          billed_on_invoice_id: _billed,
          ...rest
        } = r;
        return { ...rest, created_by: userId };
      });
      const { error: insErr } = await client.from('labour_lines').insert(clones);
      if (insErr) {
        this.logger.error(
          `creditAndRebill: failed to clone labour_lines for invoice ${invoiceId}: ${insErr.message}`,
        );
      } else {
        clonedLabourCount = clones.length;
      }
    }

    // 5. Reopen the JC + status history (no guard on current status —
    // the invoice's existence is proof we should reopen).
    const { error: jcErr } = await client
      .from('job_cards')
      .update({ status: 'in_progress', date_closed: null })
      .eq('id', invoice.job_card_id)
      .eq('tenant_id', tenantId);
    if (jcErr) {
      this.logger.error(
        `creditAndRebill: failed to reopen JC ${invoice.job_card_id}: ${jcErr.message}`,
      );
    } else {
      await client.from('job_status_history').insert({
        tenant_id: tenantId,
        job_card_id: invoice.job_card_id,
        from_status: 'invoiced',
        to_status: 'in_progress',
        changed_by: userId,
        notes: `Reopened via credit-and-rebill (NC ${creditNote.credit_note_number})`,
      });
    }

    await this.audit.record(tenantId, userId, null, {
      action: 'invoice.credit_and_rebill',
      entityType: 'invoice',
      entityId: invoiceId,
      summary: `Invoice ${invoice.invoice_number} credited and JC reopened for rebilling`,
      metadata: {
        credit_note_id: creditNote.id as string,
        credit_note_number: creditNote.credit_note_number as string,
        cloned_parts_count: clonedPartsCount,
        cloned_labour_count: clonedLabourCount,
        job_card_id: invoice.job_card_id as string,
        reason,
      },
    });

    return {
      credit_note: creditNote,
      job_card_id: invoice.job_card_id as string,
      cloned_parts_count: clonedPartsCount,
      cloned_labour_count: clonedLabourCount,
    };
  }

  /**
   * Tenant-wide credit-note register. Surfaces issued NCs for the
   * back-office page so finance has a single pane; each row joins
   * back to the invoice number and customer for context.
   */
  async listAll(tenantId: string, limit = 200) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('credit_notes')
      .select(
        '*, invoice:invoices(id, invoice_number, customer:customers(id, full_name))',
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }
}
