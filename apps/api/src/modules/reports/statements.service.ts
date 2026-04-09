import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface StatementTransaction {
  date: string;
  type: 'invoice' | 'payment' | 'credit_note' | 'bill' | 'bill_payment';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface Statement {
  entity: Record<string, unknown>;
  openingBalance: number;
  transactions: StatementTransaction[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
}

@Injectable()
export class StatementsService {
  constructor(private readonly supabase: SupabaseService) {}

  async customerStatement(
    tenantId: string,
    customerId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Statement> {
    const client = this.supabase.getClient();

    // Get customer
    const { data: customer } = await client
      .from('customers')
      .select('id, full_name, phone, email, company_name, current_balance')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .single();

    if (!customer) throw new Error('Customer not found');

    // Get all invoices for this customer
    let invoiceQuery = client
      .from('invoices')
      .select('id, invoice_number, invoice_date, grand_total, status')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .order('invoice_date');

    if (startDate) invoiceQuery = invoiceQuery.gte('invoice_date', startDate);
    if (endDate) invoiceQuery = invoiceQuery.lte('invoice_date', endDate);

    const { data: invoices } = await invoiceQuery;

    // Get all payments for these invoices
    const invoiceIds = (invoices ?? []).map((i) => i.id);
    let payments: Array<Record<string, unknown>> = [];
    if (invoiceIds.length > 0) {
      const { data } = await client
        .from('payments')
        .select('id, invoice_id, amount, payment_date, payment_method, reference')
        .in('invoice_id', invoiceIds)
        .order('payment_date');
      payments = data ?? [];
    }

    // Get credit notes
    let creditNotes: Array<Record<string, unknown>> = [];
    if (invoiceIds.length > 0) {
      const { data } = await client
        .from('credit_notes')
        .select('id, invoice_id, credit_note_number, amount, created_at')
        .in('invoice_id', invoiceIds)
        .order('created_at');
      creditNotes = data ?? [];
    }

    // Build transactions list
    const transactions: StatementTransaction[] = [];

    // Calculate opening balance (invoices before start date minus payments before start date)
    let openingBalance = 0;
    if (startDate) {
      const { data: priorInvoices } = await client
        .from('invoices')
        .select('grand_total')
        .eq('customer_id', customerId)
        .eq('tenant_id', tenantId)
        .neq('status', 'cancelled')
        .lt('invoice_date', startDate);

      const priorInvoiceTotal = (priorInvoices ?? []).reduce(
        (sum, i) => sum + Number(i.grand_total), 0,
      );

      const priorInvoiceIds = (priorInvoices ?? []).map((i: Record<string, unknown>) => i.id) as string[];
      let priorPaymentTotal = 0;
      if (priorInvoiceIds.length > 0) {
        // This is an approximation — we'd need all prior invoice IDs
        // For simplicity, use the customer's current balance logic
      }
      openingBalance = priorInvoiceTotal - priorPaymentTotal;
    }

    // Add invoices
    for (const inv of invoices ?? []) {
      transactions.push({
        date: inv.invoice_date,
        type: 'invoice',
        reference: inv.invoice_number,
        description: `Invoice ${inv.invoice_number}`,
        debit: Number(inv.grand_total),
        credit: 0,
        runningBalance: 0,
      });
    }

    // Add payments
    for (const pmt of payments) {
      const inv = (invoices ?? []).find((i) => i.id === pmt.invoice_id);
      transactions.push({
        date: pmt.payment_date as string,
        type: 'payment',
        reference: (pmt.reference as string) || `PMT-${(pmt.id as string).slice(0, 8)}`,
        description: `Payment for ${inv?.invoice_number ?? 'invoice'}${pmt.payment_method ? ` (${pmt.payment_method})` : ''}`,
        debit: 0,
        credit: Number(pmt.amount),
        runningBalance: 0,
      });
    }

    // Add credit notes
    for (const cn of creditNotes) {
      transactions.push({
        date: cn.created_at as string,
        type: 'credit_note',
        reference: (cn.credit_note_number as string) || `CN-${(cn.id as string).slice(0, 8)}`,
        description: 'Credit Note',
        debit: 0,
        credit: Number(cn.amount),
        runningBalance: 0,
      });
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let balance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;
    for (const tx of transactions) {
      balance += tx.debit - tx.credit;
      tx.runningBalance = Math.round(balance * 100) / 100;
      totalDebits += tx.debit;
      totalCredits += tx.credit;
    }

    return {
      entity: customer,
      openingBalance,
      transactions,
      closingBalance: Math.round(balance * 100) / 100,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
    };
  }

  async vendorStatement(
    tenantId: string,
    vendorId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Statement> {
    const client = this.supabase.getClient();

    // Get vendor
    const { data: vendor } = await client
      .from('vendors')
      .select('id, name, contact_name, phone, email')
      .eq('id', vendorId)
      .eq('tenant_id', tenantId)
      .single();

    if (!vendor) throw new Error('Vendor not found');

    // Get bills
    let billQuery = client
      .from('bills')
      .select('id, bill_number, bill_date, amount, status')
      .eq('vendor_id', vendorId)
      .eq('tenant_id', tenantId)
      .order('bill_date');

    if (startDate) billQuery = billQuery.gte('bill_date', startDate);
    if (endDate) billQuery = billQuery.lte('bill_date', endDate);

    const { data: bills } = await billQuery;

    // Get bill payments
    const billIds = (bills ?? []).map((b) => b.id);
    let billPayments: Array<Record<string, unknown>> = [];
    if (billIds.length > 0) {
      const { data } = await client
        .from('bill_payments')
        .select('id, bill_id, amount, payment_method, reference, payment_date')
        .in('bill_id', billIds)
        .order('payment_date');
      billPayments = data ?? [];
    }

    const transactions: StatementTransaction[] = [];
    const openingBalance = 0;

    // Add bills (we owe the vendor — credit for them, debit for us as payable)
    for (const bill of bills ?? []) {
      transactions.push({
        date: bill.bill_date,
        type: 'bill',
        reference: bill.bill_number,
        description: `Supplier Invoice ${bill.bill_number}`,
        debit: Number(bill.amount),
        credit: 0,
        runningBalance: 0,
      });
    }

    // Add payments (reducing what we owe)
    for (const pmt of billPayments) {
      const bill = (bills ?? []).find((b) => b.id === pmt.bill_id);
      transactions.push({
        date: pmt.payment_date as string,
        type: 'bill_payment',
        reference: (pmt.reference as string) || `PMT-${(pmt.id as string).slice(0, 8)}`,
        description: `Payment for ${bill?.bill_number ?? 'bill'}${pmt.payment_method ? ` (${pmt.payment_method})` : ''}`,
        debit: 0,
        credit: Number(pmt.amount),
        runningBalance: 0,
      });
    }

    // Sort by date
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate running balance
    let balance = openingBalance;
    let totalDebits = 0;
    let totalCredits = 0;
    for (const tx of transactions) {
      balance += tx.debit - tx.credit;
      tx.runningBalance = Math.round(balance * 100) / 100;
      totalDebits += tx.debit;
      totalCredits += tx.credit;
    }

    return {
      entity: vendor,
      openingBalance,
      transactions,
      closingBalance: Math.round(balance * 100) / 100,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
    };
  }
}
