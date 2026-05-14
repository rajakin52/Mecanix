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
  // Invoice-specific fields (null on payments / credit notes)
  due_date?: string | null;
  balance_due?: number | null;
  days_overdue?: number | null;
  status?: string | null;
  aging_bucket?: 'current' | '30' | '60' | '90+' | null;
}

export interface AgingBuckets {
  current: number;
  thirty: number;
  sixty: number;
  ninety: number;
  total: number;
}

export interface Statement {
  entity: Record<string, unknown>;
  openingBalance: number;
  transactions: StatementTransaction[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
  /** Aging of unpaid invoices in the statement window (current AR). */
  aging?: AgingBuckets;
}

export type AgingBucket = 'current' | '30' | '60' | '90' | '90+';

export interface AgingReceivableRow {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string | null;
  due_date: string | null;
  days_overdue: number;
  bucket: AgingBucket;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
}

export interface AgingTotals {
  current: number;
  thirty: number;
  sixty: number;
  ninety: number;
  ninetyPlus: number;
  total: number;
  invoice_count: number;
}

export interface AgingCustomerGroup {
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  invoices: AgingReceivableRow[];
  totals: AgingTotals;
}

export interface AgingReceivablesReport {
  as_of_date: string;
  customers: AgingCustomerGroup[];
  totals: AgingTotals;
}

function makeEmptyTotals(): AgingTotals {
  return {
    current: 0,
    thirty: 0,
    sixty: 0,
    ninety: 0,
    ninetyPlus: 0,
    total: 0,
    invoice_count: 0,
  };
}

function addToBucket(t: AgingTotals, r: AgingReceivableRow) {
  t.total += r.balance_due;
  t.invoice_count++;
  switch (r.bucket) {
    case 'current':
      t.current += r.balance_due;
      break;
    case '30':
      t.thirty += r.balance_due;
      break;
    case '60':
      t.sixty += r.balance_due;
      break;
    case '90':
      t.ninety += r.balance_due;
      break;
    case '90+':
      t.ninetyPlus += r.balance_due;
      break;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundTotals(t: AgingTotals): AgingTotals {
  return {
    current: round2(t.current),
    thirty: round2(t.thirty),
    sixty: round2(t.sixty),
    ninety: round2(t.ninety),
    ninetyPlus: round2(t.ninetyPlus),
    total: round2(t.total),
    invoice_count: t.invoice_count,
  };
}

function emptyAgingReport(asOfDate: string): AgingReceivablesReport {
  return {
    as_of_date: asOfDate,
    customers: [],
    totals: makeEmptyTotals(),
  };
}

export interface CustomerBalanceRow {
  customer_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  open_invoices: number;
  current: number;
  thirty: number;
  sixty: number;
  ninety: number;
  total_outstanding: number;
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
      .select('id, invoice_number, invoice_date, due_date, grand_total, balance_due, status')
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

    // Add invoices (with aging info for unpaid lines)
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayMs = new Date(todayStr).getTime();
    for (const inv of invoices ?? []) {
      const balanceDue = Number(inv.balance_due ?? 0);
      const isPaid = inv.status === 'paid' || balanceDue <= 0;
      let daysOverdue: number | null = null;
      let bucket: 'current' | '30' | '60' | '90+' | null = null;
      if (!isPaid) {
        const dueDate = inv.due_date as string | null;
        if (dueDate) {
          const dueMs = new Date(dueDate).getTime();
          const diffDays = Math.floor((todayMs - dueMs) / (1000 * 60 * 60 * 24));
          daysOverdue = Math.max(0, diffDays);
        } else {
          daysOverdue = 0;
        }
        bucket = daysOverdue <= 0
          ? 'current'
          : daysOverdue <= 30
            ? '30'
            : daysOverdue <= 60
              ? '60'
              : '90+';
      }
      transactions.push({
        date: inv.invoice_date,
        type: 'invoice',
        reference: inv.invoice_number,
        description: `Invoice ${inv.invoice_number}`,
        debit: Number(inv.grand_total),
        credit: 0,
        runningBalance: 0,
        due_date: (inv.due_date as string | null) ?? null,
        balance_due: balanceDue,
        days_overdue: daysOverdue,
        aging_bucket: bucket,
        status: inv.status as string,
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

    // Aging summary — only over the invoice rows in this statement window
    const aging: AgingBuckets = { current: 0, thirty: 0, sixty: 0, ninety: 0, total: 0 };
    for (const tx of transactions) {
      if (tx.type !== 'invoice' || !tx.aging_bucket) continue;
      const due = Number(tx.balance_due ?? 0);
      if (due <= 0) continue;
      aging.total += due;
      if (tx.aging_bucket === 'current') aging.current += due;
      else if (tx.aging_bucket === '30') aging.thirty += due;
      else if (tx.aging_bucket === '60') aging.sixty += due;
      else aging.ninety += due;
    }
    aging.current = Math.round(aging.current * 100) / 100;
    aging.thirty = Math.round(aging.thirty * 100) / 100;
    aging.sixty = Math.round(aging.sixty * 100) / 100;
    aging.ninety = Math.round(aging.ninety * 100) / 100;
    aging.total = Math.round(aging.total * 100) / 100;

    return {
      entity: customer,
      openingBalance,
      transactions,
      closingBalance: Math.round(balance * 100) / 100,
      totalDebits: Math.round(totalDebits * 100) / 100,
      totalCredits: Math.round(totalCredits * 100) / 100,
      aging,
    };
  }

  /**
   * "All customers" view: one row per customer with open balance and
   * ageing buckets. Powers the SOA report's "All" mode. Customers with
   * nothing outstanding are omitted.
   */
  async customerBalances(tenantId: string): Promise<CustomerBalanceRow[]> {
    const client = this.supabase.getClient();

    const { data: invoices, error } = await client
      .from('invoices')
      .select('customer_id, balance_due, due_date, status, customer:customers(id, full_name, phone, email)')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("paid","cancelled")')
      .gt('balance_due', 0);
    if (error) throw error;

    const todayMs = Date.now();
    const pickOne = <T>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? v[0] ?? null : v ?? null;

    type Acc = {
      customer_id: string;
      full_name: string;
      phone: string | null;
      email: string | null;
      open_invoices: number;
      current: number;
      thirty: number;
      sixty: number;
      ninety: number;
      total_outstanding: number;
    };
    const map = new Map<string, Acc>();

    type Row = {
      customer_id: string;
      balance_due: number;
      due_date: string | null;
      status: string;
      customer: { id: string; full_name: string; phone: string | null; email: string | null } | Array<{ id: string; full_name: string; phone: string | null; email: string | null }> | null;
    };

    for (const r of (invoices ?? []) as unknown as Row[]) {
      const cust = pickOne(r.customer);
      if (!cust) continue;
      let bucket: 'current' | 'thirty' | 'sixty' | 'ninety';
      if (r.due_date) {
        const overdueDays = Math.floor((todayMs - new Date(r.due_date).getTime()) / (1000 * 60 * 60 * 24));
        bucket = overdueDays <= 0
          ? 'current'
          : overdueDays <= 30 ? 'thirty'
            : overdueDays <= 60 ? 'sixty' : 'ninety';
      } else {
        bucket = 'current';
      }
      const balance = Number(r.balance_due ?? 0);
      const existing = map.get(cust.id);
      if (existing) {
        existing.open_invoices++;
        existing[bucket] += balance;
        existing.total_outstanding += balance;
      } else {
        map.set(cust.id, {
          customer_id: cust.id,
          full_name: cust.full_name,
          phone: cust.phone,
          email: cust.email,
          open_invoices: 1,
          current: bucket === 'current' ? balance : 0,
          thirty: bucket === 'thirty' ? balance : 0,
          sixty: bucket === 'sixty' ? balance : 0,
          ninety: bucket === 'ninety' ? balance : 0,
          total_outstanding: balance,
        });
      }
    }

    return Array.from(map.values())
      .map((r) => ({
        ...r,
        current: Math.round(r.current * 100) / 100,
        thirty: Math.round(r.thirty * 100) / 100,
        sixty: Math.round(r.sixty * 100) / 100,
        ninety: Math.round(r.ninety * 100) / 100,
        total_outstanding: Math.round(r.total_outstanding * 100) / 100,
      }))
      .sort((a, b) => b.total_outstanding - a.total_outstanding);
  }

  /**
   * Aging-of-receivables report.
   *
   * Returns per-invoice rows with bucket assignment, customer subtotals, and
   * grand totals — the classic AR aging schedule.
   *
   * Honors an `asOfDate` snapshot: when provided, the balance is recomputed
   * by subtracting payments and credit notes dated AFTER the snapshot, so
   * the report reflects what was open on that date rather than today.
   */
  async agingReceivables(
    tenantId: string,
    options: { customerId?: string; asOfDate?: string } = {},
  ): Promise<AgingReceivablesReport> {
    const client = this.supabase.getClient();
    const asOf = options.asOfDate ? new Date(options.asOfDate) : new Date();
    const asOfDateStr = asOf.toISOString().slice(0, 10);
    const asOfMs = new Date(asOfDateStr).getTime();

    // Pull every invoice that was issued on or before the as-of date.
    // We filter to non-cancelled — paid invoices are included so we can
    // re-add payments/CNs back if they happened after the snapshot.
    let invoiceQuery = client
      .from('invoices')
      .select(
        'id, customer_id, invoice_number, invoice_date, due_date, grand_total, paid_amount, balance_due, status',
      )
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .lte('invoice_date', asOfDateStr);
    if (options.customerId) invoiceQuery = invoiceQuery.eq('customer_id', options.customerId);
    const { data: invoices, error: invErr } = await invoiceQuery;
    if (invErr) throw invErr;

    const invoiceIds = (invoices ?? []).map((i) => i.id as string);
    if (invoiceIds.length === 0) {
      return emptyAgingReport(asOfDateStr);
    }

    // Customers in one fetch.
    const customerIds = Array.from(
      new Set((invoices ?? []).map((i) => i.customer_id as string).filter(Boolean)),
    );
    const { data: customerRows } = await client
      .from('customers')
      .select('id, full_name, phone, email, company_name')
      .in('id', customerIds);
    const customerById = new Map<string, { full_name: string; phone: string | null; email: string | null; company_name: string | null }>();
    for (const c of customerRows ?? []) {
      customerById.set(c.id as string, {
        full_name: (c.full_name as string) ?? '',
        phone: (c.phone as string | null) ?? null,
        email: (c.email as string | null) ?? null,
        company_name: (c.company_name as string | null) ?? null,
      });
    }

    // Payments AFTER the as-of date — these are added back to balance.
    const { data: latePayments } = await client
      .from('payments')
      .select('invoice_id, amount, payment_date')
      .in('invoice_id', invoiceIds)
      .gt('payment_date', asOfDateStr);
    const paymentAdjustment = new Map<string, number>();
    for (const p of latePayments ?? []) {
      const id = p.invoice_id as string;
      paymentAdjustment.set(id, (paymentAdjustment.get(id) ?? 0) + Number(p.amount ?? 0));
    }

    // Credit notes AFTER the as-of date — same treatment.
    const { data: lateCns } = await client
      .from('credit_notes')
      .select('invoice_id, amount, created_at')
      .in('invoice_id', invoiceIds)
      .gt('created_at', asOfDateStr);
    for (const c of lateCns ?? []) {
      const id = c.invoice_id as string;
      paymentAdjustment.set(id, (paymentAdjustment.get(id) ?? 0) + Number(c.amount ?? 0));
    }

    const rows: AgingReceivableRow[] = [];
    for (const inv of invoices ?? []) {
      const id = inv.id as string;
      const todayBalance = Number(inv.balance_due ?? 0);
      const adjust = paymentAdjustment.get(id) ?? 0;
      // Snapshot balance = today's balance + (payments/CNs after as-of).
      // Clamped at the invoice's grand_total just to be safe.
      const grandTotal = Number(inv.grand_total ?? 0);
      const snapshotBalance = Math.min(grandTotal, todayBalance + adjust);
      if (snapshotBalance <= 0) continue;

      const dueDate = inv.due_date as string | null;
      let daysOverdue = 0;
      let bucket: AgingBucket = 'current';
      if (dueDate) {
        const diff = Math.floor((asOfMs - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24));
        daysOverdue = Math.max(0, diff);
      }
      if (daysOverdue <= 0) bucket = 'current';
      else if (daysOverdue <= 30) bucket = '30';
      else if (daysOverdue <= 60) bucket = '60';
      else if (daysOverdue <= 90) bucket = '90';
      else bucket = '90+';

      const cust = customerById.get(inv.customer_id as string);
      rows.push({
        invoice_id: id,
        invoice_number: (inv.invoice_number as string) ?? '',
        invoice_date: (inv.invoice_date as string) ?? null,
        due_date: dueDate,
        days_overdue: daysOverdue,
        bucket,
        grand_total: grandTotal,
        paid_amount: Math.max(0, grandTotal - snapshotBalance),
        balance_due: round2(snapshotBalance),
        customer_id: (inv.customer_id as string) ?? null,
        customer_name:
          cust?.company_name?.trim()?.length ? cust.company_name : (cust?.full_name ?? '—'),
        customer_phone: cust?.phone ?? null,
        customer_email: cust?.email ?? null,
      });
    }

    // Group into customer buckets.
    const byCustomer = new Map<string, AgingCustomerGroup>();
    const totals: AgingTotals = makeEmptyTotals();
    for (const r of rows) {
      const key = r.customer_id ?? '__no_customer__';
      let g = byCustomer.get(key);
      if (!g) {
        g = {
          customer_id: r.customer_id,
          customer_name: r.customer_name,
          customer_phone: r.customer_phone,
          customer_email: r.customer_email,
          invoices: [],
          totals: makeEmptyTotals(),
        };
        byCustomer.set(key, g);
      }
      g.invoices.push(r);
      addToBucket(g.totals, r);
      addToBucket(totals, r);
    }

    // Sort customers by total desc, invoices oldest-due first.
    const customers = Array.from(byCustomer.values())
      .map((g) => ({
        ...g,
        invoices: g.invoices.sort((a, b) => (b.days_overdue ?? 0) - (a.days_overdue ?? 0)),
        totals: roundTotals(g.totals),
      }))
      .sort((a, b) => b.totals.total - a.totals.total);

    return {
      as_of_date: asOfDateStr,
      customers,
      totals: roundTotals(totals),
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
