import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { RecordInvoicePaymentInput } from '@mecanix/validators';

@Injectable()
export class PaymentsService {
  constructor(private readonly supabase: SupabaseService) {}

  async recordPayment(
    tenantId: string,
    userId: string,
    invoiceId: string,
    input: RecordInvoicePaymentInput,
  ) {
    const client = this.supabase.getClient();

    // Verify invoice exists
    const { data: invoice, error: invError } = await client
      .from('invoices')
      .select('id, grand_total, paid_amount, balance_due')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)

      .single();

    if (invError || !invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // 1. Insert payment record
    const { data: payment, error: payError } = await client
      .from('payments')
      .insert({
        tenant_id: tenantId,
        invoice_id: invoiceId,
        amount: input.amount,
        payment_method: input.paymentMethod,
        reference: input.reference || null,
        notes: input.notes || null,
        payment_date: input.paymentDate || new Date().toISOString(),
        created_by: userId,
      })
      .select()
      .single();

    if (payError) throw payError;

    // 2. Update invoice totals
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const newPaidAmount = round2(((invoice.paid_amount as number) || 0) + input.amount);
    const newBalanceDue = round2(((invoice.grand_total as number) || 0) - newPaidAmount);

    // 3. Determine new status
    const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial';

    const { error: updateError } = await client
      .from('invoices')
      .update({
        paid_amount: newPaidAmount,
        balance_due: Math.max(newBalanceDue, 0),
        status: newStatus,

      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    if (updateError) throw updateError;

    return payment;
  }

  async listByInvoice(tenantId: string, invoiceId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data ?? [];
  }
}
