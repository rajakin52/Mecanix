import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateCreditNoteInput } from '@mecanix/validators';

@Injectable()
export class CreditNotesService {
  constructor(private readonly supabase: SupabaseService) {}

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
}
