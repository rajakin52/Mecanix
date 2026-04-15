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

    // Generate receipt number
    const { data: receiptNumber } = await client.rpc('generate_receipt_number', { p_tenant_id: tenantId });

    // Get customer + vehicle info for receipt
    const { data: invoiceFull } = await client
      .from('invoices')
      .select('invoice_number, customer:customers(full_name, phone), job_card:job_cards(vehicle:vehicles(plate))')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    const customer = invoiceFull?.customer as Record<string, unknown> | null;
    const jobCard = invoiceFull?.job_card as Record<string, unknown> | null;
    const vehicle = jobCard?.vehicle as Record<string, unknown> | null;

    // 1. Insert payment record with receipt data
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
        receipt_number: receiptNumber ?? null,
        customer_name: (customer?.full_name as string) ?? null,
        customer_phone: (customer?.phone as string) ?? null,
        vehicle_plate: (vehicle?.plate as string) ?? null,
        invoice_number: (invoiceFull?.invoice_number as string) ?? null,
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
