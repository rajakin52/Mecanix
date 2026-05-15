import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class ReportsService {
  constructor(private readonly supabase: SupabaseService) {}

  async revenueReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    // Invoices in date range
    const { data: invoices, error: invError } = await client
      .from('invoices')
      .select('grand_total, labour_total, parts_total, tax_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (invError) throw invError;

    const rows = invoices ?? [];
    let totalInvoiced = 0;
    let labourRevenue = 0;
    let partsRevenue = 0;
    let taxCollected = 0;

    for (const row of rows) {
      totalInvoiced += (row.grand_total as number) || 0;
      labourRevenue += (row.labour_total as number) || 0;
      partsRevenue += (row.parts_total as number) || 0;
      taxCollected += (row.tax_amount as number) || 0;
    }

    // Payments received in date range
    const { data: payments, error: payError } = await client
      .from('payments')
      .select('amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (payError) throw payError;

    let paymentsReceived = 0;
    for (const row of payments ?? []) {
      paymentsReceived += (row.amount as number) || 0;
    }

    return {
      totalInvoiced: round2(totalInvoiced),
      labourRevenue: round2(labourRevenue),
      partsRevenue: round2(partsRevenue),
      taxCollected: round2(taxCollected),
      paymentsReceived: round2(paymentsReceived),
    };
  }

  async jobCardReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    const { data: jobs, error } = await client
      .from('job_cards')
      .select('id, status, grand_total')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const rows = jobs ?? [];
    const totalJobs = rows.length;

    const byStatus: Record<string, number> = {};
    let totalValue = 0;

    for (const row of rows) {
      const status = (row.status as string) || 'unknown';
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      totalValue += (row.grand_total as number) || 0;
    }

    const averageValue = totalJobs > 0 ? round2(totalValue / totalJobs) : 0;

    return { totalJobs, byStatus, averageValue };
  }

  async technicianReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    // Clocked hours per tech (time entries)
    const { data: entries, error } = await client
      .from('time_entries')
      .select('technician_id, total_seconds, job_card_id, technician:technicians(full_name)')
      .eq('tenant_id', tenantId)
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    if (error) throw error;

    // Billed hours per tech (labour_lines — only charged lines count)
    const { data: labourLines } = await client
      .from('labour_lines')
      .select('technician_id, hours, subtotal, created_at')
      .eq('tenant_id', tenantId)
      .eq('line_status', 'charged')
      .not('technician_id', 'is', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    type TechRow = {
      technicianName: string;
      clockedSeconds: number;
      jobIds: Set<string>;
      billedHours: number;
      billedRevenue: number;
    };
    const techMap = new Map<string, TechRow>();

    for (const row of entries ?? []) {
      const techId = row.technician_id as string;
      const techName =
        (row.technician as unknown as { full_name: string } | null)?.full_name ?? 'Unknown';

      if (!techMap.has(techId)) {
        techMap.set(techId, {
          technicianName: techName,
          clockedSeconds: 0,
          jobIds: new Set(),
          billedHours: 0,
          billedRevenue: 0,
        });
      }

      const entry = techMap.get(techId)!;
      entry.clockedSeconds += (row.total_seconds as number) || 0;
      if (row.job_card_id) entry.jobIds.add(row.job_card_id as string);
    }

    for (const line of labourLines ?? []) {
      const techId = line.technician_id as string | null;
      if (!techId) continue;
      const existing = techMap.get(techId);
      if (existing) {
        existing.billedHours += Number(line.hours) || 0;
        existing.billedRevenue += Number(line.subtotal) || 0;
      } else {
        // Tech has billed work but no time entries in the window —
        // still surface them with clockedHours=0 so the mismatch is visible.
        techMap.set(techId, {
          technicianName: 'Unknown',
          clockedSeconds: 0,
          jobIds: new Set(),
          billedHours: Number(line.hours) || 0,
          billedRevenue: Number(line.subtotal) || 0,
        });
      }
    }

    return Array.from(techMap.values()).map((t) => {
      const clockedHours = t.clockedSeconds / 3600;
      const productivity = clockedHours > 0 ? t.billedHours / clockedHours : null;
      return {
        technicianName: t.technicianName,
        totalHours: round2(clockedHours),
        clockedHours: round2(clockedHours),
        billedHours: round2(t.billedHours),
        billedRevenue: round2(t.billedRevenue),
        productivityPct: productivity != null ? Math.round(productivity * 100) : null,
        jobsCount: t.jobIds.size,
      };
    });
  }

  async partsUsageReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    // Get job cards created in range, then their parts lines
    const { data: jobCards, error: jcError } = await client
      .from('job_cards')
      .select('id')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (jcError) throw jcError;

    const jobIds = (jobCards ?? []).map((j) => j.id as string);

    if (jobIds.length === 0) {
      return [];
    }

    const { data: partsLines, error: plError } = await client
      .from('parts_lines')
      .select('part_name, quantity, subtotal')
      .eq('tenant_id', tenantId)
      .in('job_card_id', jobIds);

    if (plError) throw plError;

    const partMap = new Map<string, { totalQuantity: number; totalValue: number }>();

    for (const row of partsLines ?? []) {
      const name = (row.part_name as string) || 'Unknown';
      if (!partMap.has(name)) {
        partMap.set(name, { totalQuantity: 0, totalValue: 0 });
      }
      const entry = partMap.get(name)!;
      entry.totalQuantity += (row.quantity as number) || 0;
      entry.totalValue += (row.subtotal as number) || 0;
    }

    return Array.from(partMap.entries()).map(([partName, data]) => ({
      partName,
      totalQuantity: data.totalQuantity,
      totalValue: round2(data.totalValue),
    }));
  }

  async outstandingInvoicesReport(tenantId: string) {
    const client = this.supabase.getClient();

    const { data: invoices, error } = await client
      .from('invoices')
      .select('id, invoice_number, balance_due, grand_total, paid_amount, due_date, invoice_date, status, customer:customers(full_name, phone)')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("paid","cancelled")')
      .order('due_date', { ascending: true });

    if (error) throw error;

    const now = new Date();
    const buckets = {
      current: { count: 0, totalAmount: 0 },
      thirtyDays: { count: 0, totalAmount: 0 },
      sixtyDays: { count: 0, totalAmount: 0 },
      ninetyPlus: { count: 0, totalAmount: 0 },
    };

    const pickOne = <T>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? v[0] ?? null : v ?? null;
    type Row = {
      id: string;
      invoice_number: string;
      balance_due: number;
      grand_total: number;
      paid_amount: number;
      due_date: string | null;
      invoice_date: string | null;
      status: string;
      customer: { full_name: string; phone: string | null } | Array<{ full_name: string; phone: string | null }> | null;
    };

    const rows: Array<{
      id: string;
      invoice_number: string;
      customer_name: string | null;
      customer_phone: string | null;
      invoice_date: string | null;
      due_date: string | null;
      status: string;
      grand_total: number;
      paid_amount: number;
      balance_due: number;
      days_overdue: number;
      bucket: 'current' | '30' | '60' | '90+';
    }> = [];

    for (const r of (invoices ?? []) as unknown as Row[]) {
      const balanceDue = Number(r.balance_due ?? 0);
      const dueDate = r.due_date ? new Date(r.due_date) : null;
      const customer = pickOne(r.customer);
      let bucket: 'current' | '30' | '60' | '90+' = 'current';
      let daysOverdue = 0;

      if (!dueDate || dueDate >= now) {
        buckets.current.count++;
        buckets.current.totalAmount += balanceDue;
      } else {
        daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue <= 30) {
          buckets.thirtyDays.count++;
          buckets.thirtyDays.totalAmount += balanceDue;
          bucket = '30';
        } else if (daysOverdue <= 60) {
          buckets.sixtyDays.count++;
          buckets.sixtyDays.totalAmount += balanceDue;
          bucket = '60';
        } else {
          buckets.ninetyPlus.count++;
          buckets.ninetyPlus.totalAmount += balanceDue;
          bucket = '90+';
        }
      }

      rows.push({
        id: r.id,
        invoice_number: r.invoice_number,
        customer_name: customer?.full_name ?? null,
        customer_phone: customer?.phone ?? null,
        invoice_date: r.invoice_date,
        due_date: r.due_date,
        status: r.status,
        grand_total: Number(r.grand_total ?? 0),
        paid_amount: Number(r.paid_amount ?? 0),
        balance_due: round2(balanceDue),
        days_overdue: daysOverdue,
        bucket,
      });
    }

    for (const bucket of Object.values(buckets)) {
      bucket.totalAmount = round2(bucket.totalAmount);
    }

    const total = {
      count:
        buckets.current.count +
        buckets.thirtyDays.count +
        buckets.sixtyDays.count +
        buckets.ninetyPlus.count,
      totalAmount: round2(
        buckets.current.totalAmount +
          buckets.thirtyDays.totalAmount +
          buckets.sixtyDays.totalAmount +
          buckets.ninetyPlus.totalAmount,
      ),
    };

    return { ...buckets, total, rows };
  }

  async outstandingBillsReport(tenantId: string) {
    const client = this.supabase.getClient();

    const { data: bills, error } = await client
      .from('bills')
      .select('id, bill_number, amount, paid_amount, status, due_date, bill_date, vendor:vendors(name)')
      .eq('tenant_id', tenantId)
      .neq('status', 'paid')
      .order('due_date', { ascending: true });

    if (error) throw error;

    const now = new Date();
    const buckets = {
      current: { count: 0, totalAmount: 0 },
      thirtyDays: { count: 0, totalAmount: 0 },
      sixtyDays: { count: 0, totalAmount: 0 },
      ninetyPlus: { count: 0, totalAmount: 0 },
    };

    const pickOne = <T>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? v[0] ?? null : v ?? null;
    type Row = {
      id: string;
      bill_number: string;
      amount: number;
      paid_amount: number;
      status: string;
      due_date: string | null;
      bill_date: string | null;
      vendor: { name: string } | Array<{ name: string }> | null;
    };

    const rows: Array<{
      id: string;
      bill_number: string;
      vendor_name: string | null;
      bill_date: string | null;
      due_date: string | null;
      status: string;
      amount: number;
      paid_amount: number;
      outstanding: number;
      days_overdue: number;
      bucket: 'current' | '30' | '60' | '90+';
    }> = [];

    for (const r of (bills ?? []) as unknown as Row[]) {
      const amount = Number(r.amount ?? 0);
      const paidAmount = Number(r.paid_amount ?? 0);
      const outstanding = amount - paidAmount;
      const dueDate = r.due_date ? new Date(r.due_date) : null;
      const vendor = pickOne(r.vendor);
      let bucket: 'current' | '30' | '60' | '90+' = 'current';
      let daysOverdue = 0;

      if (!dueDate || dueDate >= now) {
        buckets.current.count++;
        buckets.current.totalAmount += outstanding;
      } else {
        daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue <= 30) {
          buckets.thirtyDays.count++;
          buckets.thirtyDays.totalAmount += outstanding;
          bucket = '30';
        } else if (daysOverdue <= 60) {
          buckets.sixtyDays.count++;
          buckets.sixtyDays.totalAmount += outstanding;
          bucket = '60';
        } else {
          buckets.ninetyPlus.count++;
          buckets.ninetyPlus.totalAmount += outstanding;
          bucket = '90+';
        }
      }

      rows.push({
        id: r.id,
        bill_number: r.bill_number,
        vendor_name: vendor?.name ?? null,
        bill_date: r.bill_date,
        due_date: r.due_date,
        status: r.status,
        amount,
        paid_amount: paidAmount,
        outstanding: round2(outstanding),
        days_overdue: daysOverdue,
        bucket,
      });
    }

    for (const bucket of Object.values(buckets)) {
      bucket.totalAmount = round2(bucket.totalAmount);
    }

    const total = {
      count:
        buckets.current.count +
        buckets.thirtyDays.count +
        buckets.sixtyDays.count +
        buckets.ninetyPlus.count,
      totalAmount: round2(
        buckets.current.totalAmount +
          buckets.thirtyDays.totalAmount +
          buckets.sixtyDays.totalAmount +
          buckets.ninetyPlus.totalAmount,
      ),
    };

    return { ...buckets, total, rows };
  }

  async expenseReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    const { data: expenses, error } = await client
      .from('expenses')
      .select('category, amount')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    if (error) throw error;

    const catMap = new Map<string, { totalAmount: number; count: number }>();

    for (const row of expenses ?? []) {
      const category = (row.category as string) || 'Uncategorized';
      if (!catMap.has(category)) {
        catMap.set(category, { totalAmount: 0, count: 0 });
      }
      const entry = catMap.get(category)!;
      entry.totalAmount += (row.amount as number) || 0;
      entry.count++;
    }

    return Array.from(catMap.entries()).map(([category, data]) => ({
      category,
      totalAmount: round2(data.totalAmount),
      count: data.count,
    }));
  }

  async incomeVsExpenseReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    // Total income = payments received in range
    const { data: payments, error: payError } = await client
      .from('payments')
      .select('amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (payError) throw payError;

    let totalIncome = 0;
    for (const row of payments ?? []) {
      totalIncome += (row.amount as number) || 0;
    }

    // Total expenses in range
    const { data: expenses, error: expError } = await client
      .from('expenses')
      .select('amount')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .gte('expense_date', startDate)
      .lte('expense_date', endDate);

    if (expError) throw expError;

    let totalExpenses = 0;
    for (const row of expenses ?? []) {
      totalExpenses += (row.amount as number) || 0;
    }

    // Total bills paid in range
    const { data: bills, error: billError } = await client
      .from('bills')
      .select('paid_amount')
      .eq('tenant_id', tenantId)
      .gte('bill_date', startDate)
      .lte('bill_date', endDate);

    if (billError) throw billError;

    let totalBillsPaid = 0;
    for (const row of bills ?? []) {
      totalBillsPaid += (row.paid_amount as number) || 0;
    }

    const netProfit = totalIncome - totalExpenses - totalBillsPaid;

    return {
      totalIncome: round2(totalIncome),
      totalExpenses: round2(totalExpenses),
      totalBillsPaid: round2(totalBillsPaid),
      netProfit: round2(netProfit),
    };
  }

  async insuranceReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    const { data: claims, error } = await client
      .from('insurance_claims')
      .select('id, status, approved_amount, submitted_at, approved_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const rows = claims ?? [];
    const totalClaims = rows.length;

    const byStatus: Record<string, number> = {};
    let totalApproved = 0;
    let approvalDaysSum = 0;
    let approvalCount = 0;

    for (const row of rows) {
      const status = (row.status as string) || 'unknown';
      byStatus[status] = (byStatus[status] ?? 0) + 1;

      totalApproved += (row.approved_amount as number) || 0;

      const submittedAt = row.submitted_at as string | null;
      const approvedAt = row.approved_at as string | null;
      if (submittedAt && approvedAt) {
        const days =
          (new Date(approvedAt).getTime() - new Date(submittedAt).getTime()) /
          (1000 * 60 * 60 * 24);
        approvalDaysSum += days;
        approvalCount++;
      }
    }

    const avgApprovalDays =
      approvalCount > 0 ? round2(approvalDaysSum / approvalCount) : 0;

    return {
      totalClaims,
      byStatus,
      avgApprovalDays,
      totalApproved: round2(totalApproved),
    };
  }

  async customerRetentionReport(
    tenantId: string,
    startDate: string,
    endDate: string,
  ) {
    const client = this.supabase.getClient();

    // Get all job cards in date range with customer info
    const { data: jobCards, error } = await client
      .from('job_cards')
      .select('id, customer_id, customer:customers(id, full_name)')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const rows = jobCards ?? [];

    // Count jobs per customer
    const customerJobs = new Map<
      string,
      { name: string; count: number }
    >();

    for (const row of rows) {
      const custId = row.customer_id as string;
      if (!custId) continue;
      const custName =
        (row.customer as unknown as { full_name: string } | null)?.full_name ?? 'Unknown';

      if (!customerJobs.has(custId)) {
        customerJobs.set(custId, { name: custName, count: 0 });
      }
      customerJobs.get(custId)!.count++;
    }

    // Repeat customers: >1 job in period
    let repeatCustomers = 0;
    for (const entry of customerJobs.values()) {
      if (entry.count > 1) repeatCustomers++;
    }

    // New customers: first job ever is in this range
    // Check if customer had any job before the start date
    const customerIds = Array.from(customerJobs.keys());
    let newCustomers = 0;

    if (customerIds.length > 0) {
      const { data: priorJobs, error: priorError } = await client
        .from('job_cards')
        .select('customer_id')
        .eq('tenant_id', tenantId)
        .in('customer_id', customerIds)
        .lt('created_at', startDate);

      if (priorError) throw priorError;

      const customersWithPriorJobs = new Set(
        (priorJobs ?? []).map((j) => j.customer_id as string),
      );

      for (const custId of customerIds) {
        if (!customersWithPriorJobs.has(custId)) {
          newCustomers++;
        }
      }
    }

    // Top 10 customers by job count
    const topCustomers = Array.from(customerJobs.entries())
      .map(([customerId, data]) => ({
        customerId,
        customerName: data.name,
        jobCount: data.count,
      }))
      .sort((a, b) => b.jobCount - a.jobCount)
      .slice(0, 10);

    return { repeatCustomers, newCustomers, topCustomers };
  }

  async creditNotesReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    const { data: creditNotes, error } = await client
      .from('credit_notes')
      .select('id, credit_note_number, amount, reason, created_at, invoice_id')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = creditNotes ?? [];
    const totalCount = rows.length;
    let totalAmount = 0;

    for (const row of rows) {
      totalAmount += (row.amount as number) || 0;
    }

    return {
      totalCount,
      totalAmount: round2(totalAmount),
      notes: rows,
    };
  }

  /**
   * Parts profitability report — margin analysis per item.
   */
  async partsItemProfitability(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    // Get all parts lines from invoiced jobs in date range
    const { data: jobs } = await client
      .from('job_cards')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'invoiced')
      .gte('date_closed', startDate)
      .lte('date_closed', endDate);

    if (!jobs || jobs.length === 0) {
      return { items: [], summary: { totalRevenue: 0, totalCost: 0, totalProfit: 0, avgMargin: 0 } };
    }

    const jobIds = jobs.map((j) => j.id);

    const { data: partsLines } = await client
      .from('parts_lines')
      .select('part_name, part_number, quantity, unit_cost, sell_price, subtotal, markup_pct')
      .eq('tenant_id', tenantId)
      .in('job_card_id', jobIds);

    if (!partsLines || partsLines.length === 0) {
      return { items: [], summary: { totalRevenue: 0, totalCost: 0, totalProfit: 0, avgMargin: 0 } };
    }

    // Aggregate by part_name
    const byItem: Record<string, {
      partName: string;
      partNumber: string | null;
      qtySold: number;
      totalCost: number;
      totalRevenue: number;
      avgMarkup: number;
      occurrences: number;
    }> = {};

    for (const line of partsLines) {
      const key = (line.part_name as string) ?? 'Unknown';
      if (!byItem[key]) {
        byItem[key] = {
          partName: key,
          partNumber: line.part_number as string | null,
          qtySold: 0,
          totalCost: 0,
          totalRevenue: 0,
          avgMarkup: 0,
          occurrences: 0,
        };
      }
      const item = byItem[key]!;
      const qty = Number(line.quantity) || 0;
      const cost = Number(line.unit_cost) || 0;
      item.qtySold += qty;
      item.totalCost += round2(qty * cost);
      item.totalRevenue += Number(line.subtotal) || 0;
      item.avgMarkup += Number(line.markup_pct) || 0;
      item.occurrences += 1;
    }

    const items = Object.values(byItem).map((item) => ({
      partName: item.partName,
      partNumber: item.partNumber,
      qtySold: round2(item.qtySold),
      avgCost: item.qtySold > 0 ? round2(item.totalCost / item.qtySold) : 0,
      avgSellPrice: item.qtySold > 0 ? round2(item.totalRevenue / item.qtySold) : 0,
      avgMarkupPct: item.occurrences > 0 ? round2(item.avgMarkup / item.occurrences) : 0,
      totalRevenue: round2(item.totalRevenue),
      totalCost: round2(item.totalCost),
      grossProfit: round2(item.totalRevenue - item.totalCost),
      marginPct: item.totalRevenue > 0
        ? round2(((item.totalRevenue - item.totalCost) / item.totalRevenue) * 100)
        : 0,
    }));

    // Sort by gross profit descending
    items.sort((a, b) => b.grossProfit - a.grossProfit);

    const totalRevenue = round2(items.reduce((s, i) => s + i.totalRevenue, 0));
    const totalCost = round2(items.reduce((s, i) => s + i.totalCost, 0));
    const totalProfit = round2(totalRevenue - totalCost);
    const avgMargin = totalRevenue > 0 ? round2((totalProfit / totalRevenue) * 100) : 0;

    return {
      items,
      summary: { totalRevenue, totalCost, totalProfit, avgMargin },
    };
  }

  /**
   * Estimate vs Actual comparison report.
   */
  async estimateVsActual(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    // Get invoiced jobs with estimates
    const { data: jobs } = await client
      .from('job_cards')
      .select('id, job_number, current_estimate_id, labour_total, parts_total, grand_total, date_closed')
      .eq('tenant_id', tenantId)
      .eq('status', 'invoiced')
      .not('current_estimate_id', 'is', null)
      .gte('date_closed', startDate)
      .lte('date_closed', endDate);

    if (!jobs || jobs.length === 0) return { comparisons: [], summary: { avgVariance: 0 } };

    const comparisons = [];
    for (const job of jobs) {
      // Get estimate
      const { data: estimate } = await client
        .from('estimates')
        .select('estimate_number, grand_total, labour_total, parts_total')
        .eq('id', job.current_estimate_id)
        .single();

      if (!estimate) continue;

      const estTotal = Number(estimate.grand_total) || 0;
      const actTotal = Number(job.grand_total) || 0;
      const variance = round2(actTotal - estTotal);
      const variancePct = estTotal > 0 ? round2((variance / estTotal) * 100) : 0;

      comparisons.push({
        jobNumber: job.job_number,
        estimateNumber: estimate.estimate_number,
        dateClosed: job.date_closed,
        estimatedTotal: round2(estTotal),
        actualTotal: round2(actTotal),
        variance,
        variancePct,
        estimatedLabour: round2(Number(estimate.labour_total) || 0),
        actualLabour: round2(Number(job.labour_total) || 0),
        estimatedParts: round2(Number(estimate.parts_total) || 0),
        actualParts: round2(Number(job.parts_total) || 0),
      });
    }

    const avgVariance = comparisons.length > 0
      ? round2(comparisons.reduce((s, c) => s + c.variancePct, 0) / comparisons.length)
      : 0;

    return { comparisons, summary: { avgVariance, totalJobs: comparisons.length } };
  }

  /**
   * Inventory valuation report — current stock value by category and warehouse.
   */
  async inventoryValuationReport(tenantId: string) {
    const client = this.supabase.getClient();

    const { data: parts, error } = await client
      .from('parts')
      .select('id, part_number, description, category, stock_qty, unit_cost')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) throw error;

    const rows = parts ?? [];

    let totalSkus = 0;
    let totalUnits = 0;
    let totalValue = 0;
    const byCategory: Record<string, { skus: number; units: number; value: number }> = {};

    for (const row of rows) {
      const qty = (row.stock_qty as number) || 0;
      const cost = Number(row.unit_cost) || 0;
      const lineValue = round2(qty * cost);
      const category = (row.category as string) || 'Uncategorized';

      totalSkus++;
      totalUnits += qty;
      totalValue += lineValue;

      if (!byCategory[category]) {
        byCategory[category] = { skus: 0, units: 0, value: 0 };
      }
      byCategory[category]!.skus++;
      byCategory[category]!.units += qty;
      byCategory[category]!.value += lineValue;
    }

    // Round category values
    for (const cat of Object.values(byCategory)) {
      cat.value = round2(cat.value);
    }

    // Warehouse breakdown
    const { data: warehouseStock, error: wsError } = await client
      .from('warehouse_stock')
      .select('warehouse_id, quantity, part_id, warehouse:warehouses(name)')
      .eq('tenant_id', tenantId);

    if (wsError) throw wsError;

    // Build a map of part_id → unit_cost
    const costMap = new Map<string, number>();
    for (const row of rows) {
      costMap.set(row.id as string, Number(row.unit_cost) || 0);
    }

    const byWarehouse: Record<string, { warehouseName: string; units: number; value: number }> = {};
    for (const ws of warehouseStock ?? []) {
      const whId = ws.warehouse_id as string;
      const whName = (ws.warehouse as unknown as { name: string } | null)?.name ?? 'Unknown';
      const qty = (ws.quantity as number) || 0;
      const cost = costMap.get(ws.part_id as string) ?? 0;

      if (!byWarehouse[whId]) {
        byWarehouse[whId] = { warehouseName: whName, units: 0, value: 0 };
      }
      byWarehouse[whId]!.units += qty;
      byWarehouse[whId]!.value += round2(qty * cost);
    }

    for (const wh of Object.values(byWarehouse)) {
      wh.value = round2(wh.value);
    }

    return {
      summary: { totalSkus, totalUnits, totalValue: round2(totalValue) },
      byCategory,
      byWarehouse,
    };
  }

  /**
   * Stock movements report — inventory adjustments within date range.
   */
  async stockMovementsReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    const { data: adjustments, error } = await client
      .from('inventory_adjustments')
      .select('id, part_id, quantity_change, reason, reference, adjusted_by, warehouse_id, created_at, part:parts(description), adjuster:users!inventory_adjustments_adjusted_by_fkey(full_name), warehouse:warehouses(name)')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = adjustments ?? [];
    let totalIn = 0;
    let totalOut = 0;

    const movements = rows.map((row) => {
      const qtyChange = (row.quantity_change as number) || 0;
      if (qtyChange > 0) totalIn += qtyChange;
      else totalOut += Math.abs(qtyChange);

      return {
        partDescription: (row.part as unknown as { description: string } | null)?.description ?? 'Unknown',
        quantityChange: qtyChange,
        reason: row.reason as string,
        reference: row.reference as string | null,
        adjustedBy: (row.adjuster as unknown as { full_name: string } | null)?.full_name ?? 'Unknown',
        warehouse: (row.warehouse as unknown as { name: string } | null)?.name ?? null,
        createdAt: row.created_at as string,
      };
    });

    return {
      summary: { totalIn, totalOut, netChange: totalIn - totalOut },
      movements,
    };
  }

  /**
   * Low stock report — parts at or below reorder point.
   */
  async lowStockReport(tenantId: string) {
    const client = this.supabase.getClient();

    const { data: parts, error } = await client
      .from('parts')
      .select('id, part_number, description, stock_qty, reorder_point, supplier_id, vendor:vendors(name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    if (error) throw error;

    // Filter to low-stock items (stock_qty <= reorder_point)
    const lowStockParts = (parts ?? []).filter(
      (p) => (p.stock_qty as number) <= (p.reorder_point as number) && (p.reorder_point as number) > 0,
    );

    // For each part, get last PO date
    const partIds = lowStockParts.map((p) => p.id as string);
    let lastOrderMap = new Map<string, string>();

    if (partIds.length > 0) {
      const { data: poLines } = await client
        .from('po_lines')
        .select('part_id, created_at')
        .eq('tenant_id', tenantId)
        .in('part_id', partIds)
        .order('created_at', { ascending: false });

      for (const line of poLines ?? []) {
        const pid = line.part_id as string;
        if (!lastOrderMap.has(pid)) {
          lastOrderMap.set(pid, line.created_at as string);
        }
      }
    }

    const items = lowStockParts.map((p) => {
      const stockQty = (p.stock_qty as number) || 0;
      const reorderPoint = (p.reorder_point as number) || 0;
      return {
        partNumber: p.part_number as string | null,
        description: p.description as string,
        stockQty,
        reorderPoint,
        deficit: reorderPoint - stockQty,
        supplierName: (p.vendor as unknown as { name: string } | null)?.name ?? null,
        lastOrderDate: lastOrderMap.get(p.id as string) ?? null,
      };
    });

    // Sort by deficit descending (most critical first)
    items.sort((a, b) => b.deficit - a.deficit);

    return items;
  }

  /**
   * Purchase request summary report.
   */
  async purchaseRequestSummaryReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    const { data: prs, error } = await client
      .from('purchase_requests')
      .select('id, pr_number, status, estimated_cost, created_at, approved_at, job_card_id')
      .eq('tenant_id', tenantId)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (error) throw error;

    const rows = prs ?? [];
    const totalPrs = rows.length;

    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let orderedCount = 0;
    let receivedCount = 0;
    let totalEstimatedCost = 0;
    let approvalTimeSum = 0;
    let approvalTimeCount = 0;

    for (const row of rows) {
      const status = row.status as string;
      if (status === 'pending_approval' || status === 'draft') pendingCount++;
      else if (status === 'approved') approvedCount++;
      else if (status === 'rejected') rejectedCount++;
      else if (status === 'ordered') orderedCount++;
      else if (status === 'received' || status === 'partial_received') receivedCount++;

      totalEstimatedCost += Number(row.estimated_cost) || 0;

      const createdAt = row.created_at as string;
      const approvedAt = row.approved_at as string | null;
      if (createdAt && approvedAt) {
        const days =
          (new Date(approvedAt).getTime() - new Date(createdAt).getTime()) /
          (1000 * 60 * 60 * 24);
        approvalTimeSum += days;
        approvalTimeCount++;
      }
    }

    const avgApprovalTime =
      approvalTimeCount > 0 ? round2(approvalTimeSum / approvalTimeCount) : 0;

    // Top 10 by cost
    const topByCost = [...rows]
      .sort((a, b) => (Number(b.estimated_cost) || 0) - (Number(a.estimated_cost) || 0))
      .slice(0, 10)
      .map((r) => ({
        prNumber: r.pr_number as string,
        status: r.status as string,
        estimatedCost: round2(Number(r.estimated_cost) || 0),
        createdAt: r.created_at as string,
      }));

    return {
      summary: {
        totalPrs,
        pendingCount,
        approvedCount,
        rejectedCount,
        orderedCount,
        receivedCount,
        totalEstimatedCost: round2(totalEstimatedCost),
        avgApprovalTime,
      },
      topByCost,
    };
  }

  /**
   * Vendor performance report — PO analysis per vendor.
   */
  async vendorPerformanceReport(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    // Get POs in date range with vendor info
    const { data: pos, error } = await client
      .from('purchase_orders')
      .select('id, vendor_id, status, order_date, total_amount, created_at, updated_at, vendor:vendors(name)')
      .eq('tenant_id', tenantId)
      .gte('order_date', startDate)
      .lte('order_date', endDate);

    if (error) throw error;

    const rows = pos ?? [];
    if (rows.length === 0) return [];

    // Get PO lines for quantities
    const poIds = rows.map((r) => r.id as string);
    const { data: poLines, error: plError } = await client
      .from('po_lines')
      .select('purchase_order_id, quantity, received_qty')
      .eq('tenant_id', tenantId)
      .in('purchase_order_id', poIds);

    if (plError) throw plError;

    // Build per-PO line aggregates
    const poLineAgg = new Map<string, { ordered: number; received: number }>();
    for (const line of poLines ?? []) {
      const poId = line.purchase_order_id as string;
      if (!poLineAgg.has(poId)) {
        poLineAgg.set(poId, { ordered: 0, received: 0 });
      }
      const entry = poLineAgg.get(poId)!;
      entry.ordered += (line.quantity as number) || 0;
      entry.received += (line.received_qty as number) || 0;
    }

    // Aggregate per vendor
    const vendorMap = new Map<
      string,
      {
        vendorName: string;
        totalPOs: number;
        totalAmount: number;
        deliveryDaysSum: number;
        deliveredCount: number;
        onTimeCount: number;
        totalItemsOrdered: number;
        totalItemsReceived: number;
      }
    >();

    for (const po of rows) {
      const vendorId = po.vendor_id as string;
      const vendorName =
        (po.vendor as unknown as { name: string } | null)?.name ?? 'Unknown';

      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          vendorName,
          totalPOs: 0,
          totalAmount: 0,
          deliveryDaysSum: 0,
          deliveredCount: 0,
          onTimeCount: 0,
          totalItemsOrdered: 0,
          totalItemsReceived: 0,
        });
      }

      const entry = vendorMap.get(vendorId)!;
      entry.totalPOs++;
      entry.totalAmount += Number(po.total_amount) || 0;

      // If PO is complete, calculate delivery time from order_date to updated_at
      if (po.status === 'complete') {
        const orderDate = new Date(po.order_date as string);
        const completedDate = new Date(po.updated_at as string);
        const days = Math.max(
          0,
          (completedDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        entry.deliveryDaysSum += days;
        entry.deliveredCount++;
      }

      const lineAgg = poLineAgg.get(po.id as string);
      if (lineAgg) {
        entry.totalItemsOrdered += lineAgg.ordered;
        entry.totalItemsReceived += lineAgg.received;
      }
    }

    return Array.from(vendorMap.values()).map((v) => ({
      vendorName: v.vendorName,
      totalPOs: v.totalPOs,
      totalAmount: round2(v.totalAmount),
      avgDeliveryDays:
        v.deliveredCount > 0 ? round2(v.deliveryDaysSum / v.deliveredCount) : null,
      onTimePct:
        v.deliveredCount > 0 ? round2((v.onTimeCount / v.deliveredCount) * 100) : null,
      totalItemsOrdered: v.totalItemsOrdered,
      totalItemsReceived: v.totalItemsReceived,
    }));
  }

  /**
   * WIP Inventory report — parts sitting on open job cards that haven't been invoiced yet.
   * Point-in-time snapshot (no date params needed).
   */
  async wipInventoryReport(tenantId: string) {
    const client = this.supabase.getClient();

    // Get all non-invoiced job cards with customer & vehicle info
    const { data: jobs, error: jobsError } = await client
      .from('job_cards')
      .select('id, job_number, status, date_opened, customer:customers(full_name), vehicle:vehicles(plate)')
      .eq('tenant_id', tenantId)
      .neq('status', 'invoiced');

    if (jobsError) throw jobsError;

    const jobRows = jobs ?? [];
    if (jobRows.length === 0) {
      return {
        summary: {
          totalLines: 0,
          totalCostValue: 0,
          totalSellValue: 0,
          reservedCount: 0,
          issuedCount: 0,
          avgDaysOnJob: 0,
          aging: { days0to7: 0, days8to30: 0, days31to60: 0, days60plus: 0 },
          byJobStatus: [],
        },
        jobs: [],
      };
    }

    const jobIds = jobRows.map((j) => j.id as string);

    // Build job lookup for quick access
    const jobMap = new Map<
      string,
      {
        jobNumber: string;
        status: string;
        dateOpened: string;
        customerName: string;
        vehiclePlate: string;
      }
    >();
    for (const j of jobRows) {
      jobMap.set(j.id as string, {
        jobNumber: j.job_number as string,
        status: j.status as string,
        dateOpened: j.date_opened as string,
        customerName:
          (j.customer as unknown as { full_name: string } | null)?.full_name ?? 'Unknown',
        vehiclePlate:
          (j.vehicle as unknown as { plate: string } | null)?.plate ?? '-',
      });
    }

    // Get all parts lines for these jobs
    const { data: partsLines, error: plError } = await client
      .from('parts_lines')
      .select('id, job_card_id, part_name, part_number, quantity, unit_cost, sell_price, subtotal, stock_status')
      .eq('tenant_id', tenantId)
      .in('job_card_id', jobIds);

    if (plError) throw plError;

    const lines = partsLines ?? [];
    const now = new Date();

    // Per-job aggregation
    const jobAgg = new Map<
      string,
      {
        partsCount: number;
        costValue: number;
        sellValue: number;
        parts: Array<{
          partName: string;
          partNumber: string | null;
          quantity: number;
          unitCost: number;
          sellPrice: number;
          subtotal: number;
          stockStatus: string;
        }>;
      }
    >();

    let totalLines = 0;
    let totalCostValue = 0;
    let totalSellValue = 0;
    let reservedCount = 0;
    let issuedCount = 0;
    let totalDaysOnJob = 0;

    // Aging buckets (based on job date_opened)
    let days0to7 = 0;
    let days8to30 = 0;
    let days31to60 = 0;
    let days60plus = 0;

    // By job status aggregation
    const statusAgg = new Map<string, { count: number; costValue: number }>();

    for (const line of lines) {
      const jobId = line.job_card_id as string;
      const job = jobMap.get(jobId);
      if (!job) continue;

      const qty = Number(line.quantity) || 0;
      const unitCost = Number(line.unit_cost) || 0;
      const sellPrice = Number(line.sell_price) || 0;
      const subtotal = Number(line.subtotal) || 0;
      const costValue = round2(qty * unitCost);
      const stockStatus = (line.stock_status as string) || 'issued';

      totalLines++;
      totalCostValue += costValue;
      totalSellValue += subtotal;

      if (stockStatus === 'reserved') reservedCount++;
      else if (stockStatus === 'issued') issuedCount++;

      // Days on job
      const dateOpened = new Date(job.dateOpened);
      const daysOnJob = Math.max(
        0,
        Math.floor((now.getTime() - dateOpened.getTime()) / (1000 * 60 * 60 * 24)),
      );
      totalDaysOnJob += daysOnJob;

      // Aging bucket (per line, based on job open date)
      if (daysOnJob <= 7) days0to7++;
      else if (daysOnJob <= 30) days8to30++;
      else if (daysOnJob <= 60) days31to60++;
      else days60plus++;

      // Job status aggregation
      if (!statusAgg.has(job.status)) {
        statusAgg.set(job.status, { count: 0, costValue: 0 });
      }
      const sa = statusAgg.get(job.status)!;
      sa.count++;
      sa.costValue += costValue;

      // Per-job parts list
      if (!jobAgg.has(jobId)) {
        jobAgg.set(jobId, { partsCount: 0, costValue: 0, sellValue: 0, parts: [] });
      }
      const ja = jobAgg.get(jobId)!;
      ja.partsCount++;
      ja.costValue += costValue;
      ja.sellValue += subtotal;
      ja.parts.push({
        partName: (line.part_name as string) || 'Unknown',
        partNumber: (line.part_number as string | null) ?? null,
        quantity: qty,
        unitCost,
        sellPrice,
        subtotal,
        stockStatus,
      });
    }

    const avgDaysOnJob = totalLines > 0 ? round2(totalDaysOnJob / totalLines) : 0;

    const byJobStatus = Array.from(statusAgg.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      costValue: round2(data.costValue),
    }));

    // Build job-level detail, sorted by days open descending (oldest first)
    const jobDetails = Array.from(jobAgg.entries())
      .map(([jobId, agg]) => {
        const job = jobMap.get(jobId)!;
        const dateOpened = new Date(job.dateOpened);
        const daysOpen = Math.max(
          0,
          Math.floor((now.getTime() - dateOpened.getTime()) / (1000 * 60 * 60 * 24)),
        );
        return {
          jobId,
          jobNumber: job.jobNumber,
          customerName: job.customerName,
          vehiclePlate: job.vehiclePlate,
          status: job.status,
          dateOpened: job.dateOpened,
          daysOpen,
          partsCount: agg.partsCount,
          costValue: round2(agg.costValue),
          sellValue: round2(agg.sellValue),
          parts: agg.parts,
        };
      })
      .sort((a, b) => b.daysOpen - a.daysOpen);

    return {
      summary: {
        totalLines,
        totalCostValue: round2(totalCostValue),
        totalSellValue: round2(totalSellValue),
        reservedCount,
        issuedCount,
        avgDaysOnJob,
        aging: { days0to7, days8to30, days31to60, days60plus },
        byJobStatus,
      },
      jobs: jobDetails,
    };
  }

  // ── KPI Dashboard ──

  async kpiDashboard(tenantId: string, months: number) {
    const client = this.supabase.getClient();

    // Monthly KPIs from the view
    const { data: monthlyKpis } = await client
      .from('kpi_monthly')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('month', { ascending: false })
      .limit(months);

    // Close rate from estimates view
    const { data: closeRates } = await client
      .from('kpi_close_rate')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('month', { ascending: false })
      .limit(months);

    // Current month summary
    const currentMonth = (monthlyKpis ?? [])[0] ?? null;
    const currentCloseRate = (closeRates ?? [])[0] ?? null;

    // Today's stats
    const today = new Date().toISOString().split('T')[0] as string;
    const { count: todayJobCount } = await client
      .from('job_cards')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('created_at', `${today}T00:00:00`)
      .is('deleted_at', null);

    const { count: activeJobCount } = await client
      .from('job_cards')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("invoiced","cancelled")')
      .is('deleted_at', null);

    const { count: overdueInvoiceCount } = await client
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'sent')
      .lt('due_date', today);

    return {
      current_month: currentMonth ? {
        car_count: currentMonth.car_count,
        job_count: currentMonth.job_count,
        aro: currentMonth.aro,
        total_revenue: currentMonth.total_revenue,
        total_labour_hours: currentMonth.total_labour_hours,
        hours_per_ro: currentMonth.hours_per_ro,
        effective_labour_rate: currentMonth.effective_labour_rate,
        comeback_rate_pct: currentMonth.comeback_rate_pct,
        close_rate_pct: currentCloseRate?.close_rate_pct ?? 0,
        estimates_sent: currentCloseRate?.estimates_sent ?? 0,
        estimates_approved: currentCloseRate?.estimates_approved ?? 0,
      } : null,
      today: {
        new_jobs: todayJobCount ?? 0,
        active_jobs: activeJobCount ?? 0,
        overdue_invoices: overdueInvoiceCount ?? 0,
      },
      monthly_trend: (monthlyKpis ?? []).reverse(),
      close_rate_trend: (closeRates ?? []).reverse(),
    };
  }

  /** Revenue summary broken down by VAT rate (for AGT reporting). */
  async vatSummaryReport(tenantId: string, startDate: string, endDate: string) {
    const { data } = await this.supabase
      .getClient()
      .from('invoices')
      .select('subtotal, tax_amount, grand_total, vat_by_rate, invoice_date')
      .eq('tenant_id', tenantId)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .in('status', ['sent', 'partial', 'paid']);

    // Sum per-rate VAT across all invoices in the period.
    const byRate: Record<string, { rate: number; vat: number; invoices: number }> = {};
    let totalSubtotal = 0;
    let totalVat = 0;
    let totalGrand = 0;

    for (const inv of (data ?? []) as Array<Record<string, unknown>>) {
      const subtotal = Number(inv.subtotal) || 0;
      const grand = Number(inv.grand_total) || 0;
      const taxAmount = Number(inv.tax_amount) || 0;
      totalSubtotal += subtotal;
      totalVat += taxAmount;
      totalGrand += grand;
      const vatByRate = (inv.vat_by_rate as Record<string, number> | null) ?? {};
      const entries = Object.entries(vatByRate);
      if (entries.length === 0 && taxAmount > 0) {
        // Legacy invoices without breakdown — bucket under 14% (AO standard).
        const key = '14.00';
        if (!byRate[key]) byRate[key] = { rate: 14, vat: 0, invoices: 0 };
        byRate[key].vat += taxAmount;
        byRate[key].invoices += 1;
      } else {
        for (const [rate, amt] of entries) {
          if (!byRate[rate]) byRate[rate] = { rate: Number(rate), vat: 0, invoices: 0 };
          byRate[rate].vat += Number(amt) || 0;
          byRate[rate].invoices += 1;
        }
      }
    }

    return {
      period: { startDate, endDate },
      totals: {
        subtotal: Math.round(totalSubtotal * 100) / 100,
        total_vat: Math.round(totalVat * 100) / 100,
        grand_total: Math.round(totalGrand * 100) / 100,
        invoice_count: (data ?? []).length,
      },
      by_rate: Object.values(byRate)
        .sort((a, b) => b.rate - a.rate)
        .map((r) => ({ rate: r.rate, vat: Math.round(r.vat * 100) / 100, invoices: r.invoices })),
    };
  }

  /** IVA Cativo — amounts the workshop can reclaim from state via captive customers. */
  async captiveVatReport(tenantId: string, startDate: string, endDate: string) {
    const { data } = await this.supabase
      .getClient()
      .from('invoices')
      .select(`
        id, invoice_number, invoice_date, grand_total,
        vat_captive_pct, iva_captive_amount,
        customer:customers(full_name, tax_id)
      `)
      .eq('tenant_id', tenantId)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .gt('iva_captive_amount', 0)
      .order('invoice_date', { ascending: false });

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const total = rows.reduce((s, r) => s + (Number(r.iva_captive_amount) || 0), 0);

    return {
      period: { startDate, endDate },
      total_captive: Math.round(total * 100) / 100,
      invoice_count: rows.length,
      invoices: rows.map((r) => ({
        id: r.id as string,
        invoice_number: r.invoice_number as string,
        invoice_date: r.invoice_date as string,
        customer_name: (r.customer as { full_name?: string } | null)?.full_name ?? '',
        customer_tax_id: (r.customer as { tax_id?: string } | null)?.tax_id ?? null,
        grand_total: Number(r.grand_total) || 0,
        captive_pct: Number(r.vat_captive_pct) || 0,
        captive_amount: Number(r.iva_captive_amount) || 0,
      })),
    };
  }

  /** Service retention — 6.5% credits withheld by captive customers. */
  async serviceRetentionReport(tenantId: string, startDate: string, endDate: string) {
    const { data } = await this.supabase
      .getClient()
      .from('invoices')
      .select(`
        id, invoice_number, invoice_date, labour_total,
        service_retention_pct, service_retention_amount,
        customer:customers(full_name, tax_id)
      `)
      .eq('tenant_id', tenantId)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .gt('service_retention_amount', 0)
      .order('invoice_date', { ascending: false });

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const total = rows.reduce((s, r) => s + (Number(r.service_retention_amount) || 0), 0);

    return {
      period: { startDate, endDate },
      total_retention: Math.round(total * 100) / 100,
      invoice_count: rows.length,
      invoices: rows.map((r) => ({
        id: r.id as string,
        invoice_number: r.invoice_number as string,
        invoice_date: r.invoice_date as string,
        customer_name: (r.customer as { full_name?: string } | null)?.full_name ?? '',
        customer_tax_id: (r.customer as { tax_id?: string } | null)?.tax_id ?? null,
        labour_total: Number(r.labour_total) || 0,
        retention_pct: Number(r.service_retention_pct) || 0,
        retention_amount: Number(r.service_retention_amount) || 0,
      })),
    };
  }

  /**
   * Manager-grade v2 KPIs that don't fit the monthly kpi_monthly view:
   *   - Bay utilisation right now (how many bays are occupied).
   *   - First-time-right % for the current month (100 − comeback %).
   *   - Retention cohort: distinct customers with at least one job in
   *     the last 6 / 12 / 24 months, plus each period's repeat count
   *     (customers with ≥2 jobs in the window).
   *
   * All three answer questions that *change the day* — bay utilisation
   * tells the service writer whether to schedule another walk-in now,
   * FTR flags comeback drift before it eats margin, and the cohort
   * totals tell an owner whether their base is growing or churning.
   */
  async managerKpis(tenantId: string, branchId?: string | null) {
    const client = this.supabase.getClient();
    const now = Date.now();
    const todayIso = new Date(now).toISOString();

    // ── 1. Bay utilisation ─────────────────────────────────────────
    // When a branch filter is active, bays + the active-job count
    // are both scoped to that branch. When no filter, whole tenant.
    let baysQ = client
      .from('bays')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (branchId) baysQ = baysQ.eq('branch_id', branchId);

    let busyQ = client
      .from('job_cards')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('bay_id', 'is', null)
      .not('status', 'eq', 'invoiced')
      .not('status', 'eq', 'cancelled')
      .is('deleted_at', null);
    if (branchId) busyQ = busyQ.eq('branch_id', branchId);

    const [{ count: totalBays }, { count: busyBays }] = await Promise.all([baysQ, busyQ]);

    const bayTotal = totalBays ?? 0;
    const bayBusy = Math.min(busyBays ?? 0, bayTotal); // shouldn't exceed but defensive
    const bayPct = bayTotal > 0 ? Math.round((bayBusy / bayTotal) * 100) : 0;

    // ── 2. First-time-right % this month ───────────────────────────
    // Derived from the same monthly KPI view the Phase 1 card uses.
    const { data: kpi } = await client
      .from('kpi_monthly')
      .select('comeback_rate_pct, job_count')
      .eq('tenant_id', tenantId)
      .order('month', { ascending: false })
      .limit(1);
    const currentKpi = (kpi ?? [])[0];
    const comebackPct = Number(currentKpi?.comeback_rate_pct ?? 0);
    const firstTimeRightPct = Math.max(0, Math.min(100, Math.round((100 - comebackPct) * 10) / 10));

    // ── 3. Retention cohorts ───────────────────────────────────────
    const iso = (days: number) =>
      new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
    const cohort = async (days: number) => {
      const from = iso(days);
      let q = client
        .from('job_cards')
        .select('customer_id')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .gte('created_at', from)
        .lte('created_at', todayIso);
      if (branchId) q = q.eq('branch_id', branchId);
      const { data } = await q;
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const id = row.customer_id as string | null;
        if (!id) continue;
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      let active = 0;
      let repeat = 0;
      for (const n of counts.values()) {
        active++;
        if (n >= 2) repeat++;
      }
      return { active, repeat };
    };

    const [m6, m12, m24] = await Promise.all([
      cohort(183),
      cohort(365),
      cohort(730),
    ]);

    return {
      bay_utilization: { busy: bayBusy, total: bayTotal, pct: bayPct },
      first_time_right_pct: firstTimeRightPct,
      comeback_pct: Math.round(comebackPct * 10) / 10,
      retention: {
        m6,
        m12,
        m24,
      },
    };
  }

  // ════════════════════════════════════════════════════════════
  //  Parts-purchases reports
  // ════════════════════════════════════════════════════════════

  /**
   * What was purchased in a given window. Combines PO lines from POs
   * ordered in the period with approved bill lines (final invoiced cost).
   */
  async partsPurchased(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    const { data: poRows } = await client
      .from('po_lines')
      .select(
        'id, quantity, unit_cost, received_qty, part_id, description, part:parts(part_number, description), purchase_order:purchase_orders!inner(po_number, order_date, expected_date, vendor:vendors(name))',
      )
      .eq('tenant_id', tenantId)
      .gte('purchase_order.order_date', startDate)
      .lte('purchase_order.order_date', endDate);

    const { data: billRows } = await client
      .from('bill_lines')
      .select(
        'id, quantity, unit_cost, total, part_id, part_number, part_name, bill:bills!inner(bill_number, bill_date, status, vendor:vendors(name))',
      )
      .eq('tenant_id', tenantId)
      .gte('bill.bill_date', startDate)
      .lte('bill.bill_date', endDate);

    const pick = <T>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? v[0] ?? null : v ?? null;

    type PoRow = {
      id: string;
      quantity: number;
      unit_cost: number;
      received_qty: number;
      part_id: string | null;
      description: string;
      part: { part_number: string | null; description: string } | Array<{ part_number: string | null; description: string }> | null;
      purchase_order: { po_number: string; order_date: string; expected_date: string | null; vendor: { name: string } | Array<{ name: string }> | null } | null;
    };
    type BillRow = {
      id: string;
      quantity: number;
      unit_cost: number;
      total: number;
      part_id: string | null;
      part_number: string | null;
      part_name: string;
      bill: { bill_number: string; bill_date: string; status: string; vendor: { name: string } | Array<{ name: string }> | null } | null;
    };

    const lines: Array<Record<string, unknown>> = [];
    for (const r of (poRows ?? []) as unknown as PoRow[]) {
      if (!r.purchase_order) continue;
      const po = r.purchase_order;
      const part = pick(r.part);
      const vendor = pick(po.vendor);
      lines.push({
        source: 'po',
        date: po.order_date,
        document: po.po_number,
        vendor_name: vendor?.name ?? null,
        part_id: r.part_id,
        part_number: part?.part_number ?? null,
        description: part?.description ?? r.description,
        quantity: r.quantity,
        received_qty: r.received_qty,
        unit_cost: Number(r.unit_cost),
        total: Number(r.unit_cost) * r.quantity,
      });
    }
    for (const r of (billRows ?? []) as unknown as BillRow[]) {
      if (!r.bill) continue;
      const bill = r.bill;
      const vendor = pick(bill.vendor);
      lines.push({
        source: 'bill',
        date: bill.bill_date,
        document: bill.bill_number,
        vendor_name: vendor?.name ?? null,
        part_id: r.part_id,
        part_number: r.part_number,
        description: r.part_name,
        quantity: r.quantity,
        received_qty: r.quantity,
        unit_cost: Number(r.unit_cost),
        total: Number(r.total),
      });
    }

    lines.sort((a, b) => String(b.date).localeCompare(String(a.date)));

    const totals = lines.reduce<{ line_count: number; quantity: number; value: number }>(
      (acc, l) => {
        acc.line_count++;
        acc.quantity += Number(l.quantity) || 0;
        acc.value += Number(l.total) || 0;
        return acc;
      },
      { line_count: 0, quantity: 0, value: 0 },
    );

    return { lines, totals };
  }

  /**
   * POs sent or partial, with at least one line not fully received.
   * One row per outstanding line. `overdue` is true when expected_date
   * is in the past.
   */
  async pendingDeliveries(tenantId: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('po_lines')
      .select(
        'id, quantity, received_qty, unit_cost, description, part:parts(part_number, description), purchase_order:purchase_orders!inner(id, po_number, status, order_date, expected_date, vendor:vendors(name))',
      )
      .eq('tenant_id', tenantId)
      .in('purchase_order.status', ['sent', 'partial']);
    if (error) throw error;

    const pick = <T>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? v[0] ?? null : v ?? null;
    type Row = {
      id: string;
      quantity: number;
      received_qty: number;
      unit_cost: number;
      description: string;
      part: { part_number: string | null; description: string } | Array<{ part_number: string | null; description: string }> | null;
      purchase_order: { id: string; po_number: string; status: string; order_date: string; expected_date: string | null; vendor: { name: string } | Array<{ name: string }> | null } | null;
    };
    const today = new Date().toISOString().slice(0, 10);

    const rows = ((data ?? []) as unknown as Row[])
      .filter((r) => r.purchase_order && r.quantity > r.received_qty)
      .map((r) => {
        const po = r.purchase_order!;
        const part = pick(r.part);
        const vendor = pick(po.vendor);
        const outstanding = r.quantity - r.received_qty;
        return {
          po_id: po.id,
          po_number: po.po_number,
          po_status: po.status,
          order_date: po.order_date,
          expected_date: po.expected_date,
          overdue: po.expected_date != null && po.expected_date < today,
          vendor_name: vendor?.name ?? null,
          part_number: part?.part_number ?? null,
          description: part?.description ?? r.description,
          quantity: r.quantity,
          received_qty: r.received_qty,
          outstanding,
          unit_cost: Number(r.unit_cost),
          outstanding_value: outstanding * Number(r.unit_cost),
        };
      })
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return String(a.expected_date ?? '9999').localeCompare(String(b.expected_date ?? '9999'));
      });

    const totals = rows.reduce(
      (acc, r) => {
        acc.lines++;
        acc.outstanding_qty += r.outstanding;
        acc.outstanding_value += r.outstanding_value;
        if (r.overdue) acc.overdue_lines++;
        return acc;
      },
      { lines: 0, outstanding_qty: 0, outstanding_value: 0, overdue_lines: 0 },
    );

    return { rows, totals };
  }

  /**
   * Stock on hand for parts flagged as consumables.
   */
  async consumablesStock(tenantId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('parts')
      .select('id, part_number, description, category, location, stock_qty, reserved_qty, reorder_point, unit_cost, sell_price')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .eq('is_consumable', true)
      .order('description');
    if (error) throw error;

    const rows = (data ?? []).map((p) => {
      const stock = Number((p as { stock_qty: number }).stock_qty ?? 0);
      const reserved = Number((p as { reserved_qty: number }).reserved_qty ?? 0);
      const available = stock - reserved;
      const reorder = Number((p as { reorder_point: number }).reorder_point ?? 0);
      const unit_cost = Number((p as { unit_cost: number }).unit_cost ?? 0);
      return {
        ...(p as Record<string, unknown>),
        stock_qty: stock,
        available,
        below_reorder: available <= reorder,
        stock_value: round2(stock * unit_cost),
      };
    });

    const totals = rows.reduce<{ parts: number; units: number; value: number; below_reorder: number }>(
      (acc, r) => {
        acc.parts++;
        acc.units += Number(r.stock_qty) || 0;
        acc.value += Number(r.stock_value) || 0;
        if (r.below_reorder) acc.below_reorder++;
        return acc;
      },
      { parts: 0, units: 0, value: 0, below_reorder: 0 },
    );

    return { rows, totals };
  }

  /**
   * Parts in stock that have not had an `issued` movement in the last
   * `days` (default 180). Highlights working capital tied up in
   * dead/slow inventory.
   */
  async slowMovingParts(tenantId: string, days = 180) {
    const client = this.supabase.getClient();
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: moved } = await client
      .from('parts_lines')
      .select('part_number')
      .eq('tenant_id', tenantId)
      .eq('stock_status', 'issued')
      .gte('issued_at', since)
      .not('part_number', 'is', null);

    const movedKeys = new Set<string>();
    for (const m of moved ?? []) {
      const k = (m as { part_number: string | null }).part_number;
      if (k) movedKeys.add(k);
    }

    const { data: parts, error } = await client
      .from('parts')
      .select('id, part_number, description, category, stock_qty, unit_cost, sell_price, created_at')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .gt('stock_qty', 0);
    if (error) throw error;

    const rows = (parts ?? [])
      .filter((p) => {
        const pn = (p as { part_number: string | null }).part_number;
        return !pn || !movedKeys.has(pn);
      })
      .map((p) => {
        const stock = Number((p as { stock_qty: number }).stock_qty ?? 0);
        const cost = Number((p as { unit_cost: number }).unit_cost ?? 0);
        return {
          ...(p as Record<string, unknown>),
          stock_qty: stock,
          tied_up_value: round2(stock * cost),
        };
      })
      .sort((a, b) => Number(b.tied_up_value) - Number(a.tied_up_value));

    const totals = rows.reduce<{ parts: number; units: number; value: number }>(
      (acc, r) => {
        acc.parts++;
        acc.units += Number(r.stock_qty) || 0;
        acc.value += Number(r.tied_up_value) || 0;
        return acc;
      },
      { parts: 0, units: 0, value: 0 },
    );

    return { rows, totals, since };
  }

  // ════════════════════════════════════════════════════════════
  //  Drill-down lists (dashboard click-throughs)
  // ════════════════════════════════════════════════════════════

  /**
   * Parts at or below reorder point — same definition as the dashboard
   * (available = stock − reserved ≤ reorder_point). Includes parts with
   * zero or negative stock.
   */
  async lowStockDetail(tenantId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('parts')
      .select('id, part_number, description, category, location, stock_qty, reserved_qty, reorder_point, unit_cost, sell_price, vendor:vendors(name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('stock_qty', { ascending: true });
    if (error) throw error;

    type Row = {
      id: string;
      part_number: string | null;
      description: string;
      category: string | null;
      location: string | null;
      stock_qty: number;
      reserved_qty: number;
      reorder_point: number;
      unit_cost: number;
      sell_price: number;
      vendor: { name: string } | Array<{ name: string }> | null;
    };
    const pick = <T>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? v[0] ?? null : v ?? null;

    const rows = ((data ?? []) as Row[])
      .map((p) => {
        const stock = Number(p.stock_qty ?? 0);
        const reserved = Number(p.reserved_qty ?? 0);
        const reorder = Number(p.reorder_point ?? 0);
        const available = stock - reserved;
        const vendor = pick(p.vendor);
        const shortfall = Math.max(0, reorder - available);
        return {
          id: p.id,
          part_number: p.part_number,
          description: p.description,
          category: p.category,
          location: p.location,
          stock_qty: stock,
          reserved_qty: reserved,
          available,
          reorder_point: reorder,
          shortfall,
          out_of_stock: stock <= 0,
          unit_cost: Number(p.unit_cost ?? 0),
          sell_price: Number(p.sell_price ?? 0),
          vendor_name: vendor?.name ?? null,
          replenish_value: round2(shortfall * Number(p.unit_cost ?? 0)),
        };
      })
      .filter((r) => r.available <= r.reorder_point);

    const totals = rows.reduce<{ parts: number; out_of_stock: number; shortfall_units: number; replenish_value: number }>(
      (acc, r) => {
        acc.parts++;
        if (r.out_of_stock) acc.out_of_stock++;
        acc.shortfall_units += r.shortfall;
        acc.replenish_value += r.replenish_value;
        return acc;
      },
      { parts: 0, out_of_stock: 0, shortfall_units: 0, replenish_value: 0 },
    );
    totals.replenish_value = round2(totals.replenish_value);

    return { rows, totals };
  }

  async stockValuation(tenantId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('parts')
      .select('id, part_number, description, category, location, stock_qty, reserved_qty, unit_cost, sell_price, is_consumable, is_universal')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .gt('stock_qty', 0);
    if (error) throw error;

    const rows = (data ?? [])
      .map((p) => {
        const stock = Number((p as { stock_qty: number }).stock_qty ?? 0);
        const reserved = Number((p as { reserved_qty: number }).reserved_qty ?? 0);
        const cost = Number((p as { unit_cost: number }).unit_cost ?? 0);
        const sell = Number((p as { sell_price: number }).sell_price ?? 0);
        return {
          ...(p as Record<string, unknown>),
          stock_qty: stock,
          reserved_qty: reserved,
          available: stock - reserved,
          stock_value: round2(stock * cost),
          potential_revenue: round2(stock * sell),
        };
      })
      .sort((a, b) => Number(b.stock_value) - Number(a.stock_value));

    const totals = rows.reduce<{ parts: number; units: number; value: number; potential_revenue: number }>(
      (acc, r) => {
        acc.parts++;
        acc.units += Number(r.stock_qty) || 0;
        acc.value += Number(r.stock_value) || 0;
        acc.potential_revenue += Number(r.potential_revenue) || 0;
        return acc;
      },
      { parts: 0, units: 0, value: 0, potential_revenue: 0 },
    );
    totals.value = round2(totals.value);
    totals.potential_revenue = round2(totals.potential_revenue);

    return { rows, totals };
  }

  async outOfStock(tenantId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('parts')
      .select('id, part_number, description, category, location, stock_qty, reserved_qty, reorder_point, unit_cost, sell_price, vendor:vendors(name)')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .lte('stock_qty', 0);
    if (error) throw error;
    return { rows: data ?? [], totals: { parts: (data ?? []).length } };
  }

  async backorders(tenantId: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('parts')
      .select('id, part_number, description, category, stock_qty, reserved_qty, reorder_point, unit_cost, sell_price')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);
    if (error) throw error;
    const rows = (data ?? [])
      .map((p) => {
        const stock = Number((p as { stock_qty: number }).stock_qty ?? 0);
        const reserved = Number((p as { reserved_qty: number }).reserved_qty ?? 0);
        return { ...(p as Record<string, unknown>), available: stock - reserved };
      })
      .filter((r) => Number(r.available) < 0)
      .sort((a, b) => Number(a.available) - Number(b.available));
    return { rows, totals: { parts: rows.length } };
  }

  async partsDelivered(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('parts_lines')
      .select(
        'id, part_number, part_name, quantity, unit_cost, sell_price, subtotal, issued_at, job_card:job_cards(job_number, status, customer:customers(full_name), vehicle:vehicles(plate))',
      )
      .eq('tenant_id', tenantId)
      .eq('stock_status', 'issued')
      .gte('issued_at', startDate)
      .lte('issued_at', endDate)
      .order('issued_at', { ascending: false });
    if (error) throw error;

    const pick = <T>(v: T | T[] | null | undefined): T | null =>
      Array.isArray(v) ? v[0] ?? null : v ?? null;

    type Row = {
      id: string;
      part_number: string | null;
      part_name: string;
      quantity: number;
      unit_cost: number;
      sell_price: number;
      subtotal: number;
      issued_at: string;
      job_card: {
        job_number: string;
        status: string;
        customer: { full_name: string } | Array<{ full_name: string }> | null;
        vehicle: { plate: string } | Array<{ plate: string }> | null;
      } | Array<{
        job_number: string;
        status: string;
        customer: { full_name: string } | Array<{ full_name: string }> | null;
        vehicle: { plate: string } | Array<{ plate: string }> | null;
      }> | null;
    };

    const rows = ((data ?? []) as unknown as Row[]).map((r) => {
      const jc = pick(r.job_card);
      const customer = jc ? pick(jc.customer) : null;
      const vehicle = jc ? pick(jc.vehicle) : null;
      const qty = Number(r.quantity ?? 0);
      const cost = Number(r.unit_cost ?? 0);
      const revenue = Number(r.subtotal ?? 0) || qty * Number(r.sell_price ?? 0);
      return {
        id: r.id,
        issued_at: r.issued_at,
        part_number: r.part_number,
        description: r.part_name,
        quantity: qty,
        unit_cost: cost,
        sell_price: Number(r.sell_price ?? 0),
        subtotal: round2(revenue),
        margin: round2(revenue - qty * cost),
        job_number: jc?.job_number ?? null,
        job_status: jc?.status ?? null,
        customer_name: customer?.full_name ?? null,
        vehicle_plate: vehicle?.plate ?? null,
      };
    });

    const totals = rows.reduce<{ lines: number; quantity: number; revenue: number; cost: number; margin: number }>(
      (acc, r) => {
        acc.lines++;
        acc.quantity += Number(r.quantity) || 0;
        acc.revenue += Number(r.subtotal) || 0;
        acc.cost += Number(r.quantity) * Number(r.unit_cost);
        acc.margin += Number(r.margin) || 0;
        return acc;
      },
      { lines: 0, quantity: 0, revenue: 0, cost: 0, margin: 0 },
    );
    totals.revenue = round2(totals.revenue);
    totals.cost = round2(totals.cost);
    totals.margin = round2(totals.margin);

    return { rows, totals };
  }

  /**
   * Margin detail: per-part revenue + cost + margin within a window.
   * `mode` = 'issued' (parts_lines.issued_at) or 'invoiced'
   * (invoice.invoice_date join). Each part aggregated.
   */
  async marginDetail(
    tenantId: string,
    startDate: string,
    endDate: string,
    mode: 'issued' | 'invoiced',
  ) {
    const client = this.supabase.getClient();

    let lines: Array<{ part_number: string | null; part_name: string; quantity: number; unit_cost: number; sell_price: number; subtotal: number }>;
    if (mode === 'issued') {
      const { data, error } = await client
        .from('parts_lines')
        .select('part_number, part_name, quantity, unit_cost, sell_price, subtotal')
        .eq('tenant_id', tenantId)
        .eq('stock_status', 'issued')
        .gte('issued_at', startDate)
        .lte('issued_at', endDate);
      if (error) throw error;
      lines = (data ?? []) as typeof lines;
    } else {
      const { data: invs } = await client
        .from('invoices')
        .select('job_card_id')
        .eq('tenant_id', tenantId)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .not('job_card_id', 'is', null);
      const jobIds = Array.from(
        new Set(
          (invs ?? [])
            .map((i) => (i as { job_card_id: string | null }).job_card_id)
            .filter((id): id is string => !!id),
        ),
      );
      if (jobIds.length === 0) lines = [];
      else {
        const { data, error } = await client
          .from('parts_lines')
          .select('part_number, part_name, quantity, unit_cost, sell_price, subtotal')
          .eq('tenant_id', tenantId)
          .in('job_card_id', jobIds);
        if (error) throw error;
        lines = (data ?? []) as typeof lines;
      }
    }

    const agg = new Map<string, { part_number: string | null; description: string; quantity: number; revenue: number; cost: number }>();
    for (const r of lines) {
      const key = (r.part_number && r.part_number.trim()) || `__${r.part_name}`;
      const qty = Number(r.quantity ?? 0);
      const cost = qty * Number(r.unit_cost ?? 0);
      const revenue = Number(r.subtotal ?? 0) || qty * Number(r.sell_price ?? 0);
      const e = agg.get(key);
      if (e) {
        e.quantity += qty;
        e.revenue += revenue;
        e.cost += cost;
      } else {
        agg.set(key, {
          part_number: r.part_number ?? null,
          description: r.part_name,
          quantity: qty,
          revenue,
          cost,
        });
      }
    }

    const rows = Array.from(agg.values())
      .map((it) => {
        const margin = it.revenue - it.cost;
        const margin_pct = it.revenue > 0 ? (margin / it.revenue) * 100 : 0;
        return {
          part_number: it.part_number,
          description: it.description,
          quantity: it.quantity,
          revenue: round2(it.revenue),
          cost: round2(it.cost),
          margin: round2(margin),
          margin_pct: round2(margin_pct),
        };
      })
      .sort((a, b) => b.margin - a.margin);

    const totals = rows.reduce<{ items: number; quantity: number; revenue: number; cost: number; margin: number; margin_pct: number }>(
      (acc, r) => {
        acc.items++;
        acc.quantity += r.quantity;
        acc.revenue += r.revenue;
        acc.cost += r.cost;
        acc.margin += r.margin;
        return acc;
      },
      { items: 0, quantity: 0, revenue: 0, cost: 0, margin: 0, margin_pct: 0 },
    );
    totals.revenue = round2(totals.revenue);
    totals.cost = round2(totals.cost);
    totals.margin = round2(totals.margin);
    totals.margin_pct = totals.revenue > 0 ? round2((totals.margin / totals.revenue) * 100) : 0;

    return { rows, totals, mode };
  }

  /**
   * One-shot KPI bundle for the Parts → Dashboard landing. Returns:
   *   - inventory snapshot (counts, values, low-stock, out-of-stock)
   *   - procurement velocity (purchases / received: today / WTD / MTD)
   *   - pending deliveries summary, top vendors MTD, outstanding bills
   *   - consumption velocity (issued today / WTD / MTD, WIP value, top parts MTD)
   *   - health (backorders, slow-moving value, stock turnover)
   */
  async inventoryDashboard(tenantId: string) {
    const client = this.supabase.getClient();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayStart = today.toISOString();
    const dayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
    const dow = (now.getDay() + 6) % 7; // 0 = Monday
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - dow);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const yearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);

    const dayStartDate = today.toISOString().slice(0, 10);
    const weekStartDate = weekStart.toISOString().slice(0, 10);
    const monthStartDate = monthStart.toISOString().slice(0, 10);
    const todayDate = today.toISOString().slice(0, 10);

    // ── Inventory snapshot ─────────────────────────────────────
    const { data: partsAgg } = await client
      .from('parts')
      .select('id, stock_qty, reserved_qty, reorder_point, unit_cost, is_consumable')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    type PartRow = { id: string; stock_qty: number | null; reserved_qty: number | null; reorder_point: number | null; unit_cost: number | null; is_consumable: boolean };
    const parts = (partsAgg ?? []) as PartRow[];
    const inventory = {
      total_parts: parts.length,
      total_units: 0,
      stock_value: 0,
      consumables_value: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
    };
    for (const p of parts) {
      const stock = Number(p.stock_qty ?? 0);
      const reserved = Number(p.reserved_qty ?? 0);
      const reorder = Number(p.reorder_point ?? 0);
      const cost = Number(p.unit_cost ?? 0);
      const value = stock * cost;
      inventory.total_units += stock;
      inventory.stock_value += value;
      if (p.is_consumable) inventory.consumables_value += value;
      const available = stock - reserved;
      // Low stock = anything at or below reorder point, even if stock is 0.
      // Out-of-stock is a subset (stock <= 0).
      if (available <= reorder) inventory.low_stock_count++;
      if (stock <= 0) inventory.out_of_stock_count++;
    }
    inventory.stock_value = round2(inventory.stock_value);
    inventory.consumables_value = round2(inventory.consumables_value);

    // ── Procurement: purchases (PO lines by PO order_date) ─────
    const purchases = await this.aggregatePoLineValues(client, tenantId, [
      ['today', dayStartDate, todayDate],
      ['week', weekStartDate, todayDate],
      ['month', monthStartDate, todayDate],
    ]);

    // ── Procurement: received (bills by bill_date, more reliable than
    //    increments on po_lines.received_qty since we don't track when
    //    that happens). Falls back to po_lines for shops not using bills.
    const received = await this.aggregateBillLineValues(client, tenantId, [
      ['today', dayStartDate, todayDate],
      ['week', weekStartDate, todayDate],
      ['month', monthStartDate, todayDate],
    ]);

    // ── Procurement: pending deliveries (sent/partial POs with backlog)
    const { data: pendingRows } = await client
      .from('po_lines')
      .select('quantity, received_qty, unit_cost, purchase_order:purchase_orders!inner(status, expected_date)')
      .eq('tenant_id', tenantId)
      .in('purchase_order.status', ['sent', 'partial']);
    type PendRow = {
      quantity: number;
      received_qty: number;
      unit_cost: number;
      purchase_order: { status: string; expected_date: string | null } | Array<{ status: string; expected_date: string | null }> | null;
    };
    const pickPO = (v: PendRow['purchase_order']) => Array.isArray(v) ? v[0] ?? null : v ?? null;
    const pending = { count: 0, value: 0, overdue_count: 0 };
    for (const r of (pendingRows ?? []) as PendRow[]) {
      const po = pickPO(r.purchase_order);
      if (!po) continue;
      const outstanding = (r.quantity ?? 0) - (r.received_qty ?? 0);
      if (outstanding <= 0) continue;
      pending.count++;
      pending.value += outstanding * Number(r.unit_cost ?? 0);
      if (po.expected_date && po.expected_date < todayDate) pending.overdue_count++;
    }
    pending.value = round2(pending.value);

    // ── Top vendors MTD ────────────────────────────────────────
    const { data: vendorRows } = await client
      .from('bills')
      .select('amount, bill_date, vendor:vendors(id, name)')
      .eq('tenant_id', tenantId)
      .gte('bill_date', monthStartDate)
      .lte('bill_date', todayDate);
    type VendorRow = { amount: number; bill_date: string; vendor: { id: string; name: string } | Array<{ id: string; name: string }> | null };
    const vendorAgg = new Map<string, { vendor_id: string; vendor_name: string; amount: number; count: number }>();
    for (const r of (vendorRows ?? []) as VendorRow[]) {
      const v = Array.isArray(r.vendor) ? r.vendor[0] ?? null : r.vendor ?? null;
      if (!v) continue;
      const e = vendorAgg.get(v.id);
      if (e) {
        e.amount += Number(r.amount ?? 0);
        e.count++;
      } else {
        vendorAgg.set(v.id, { vendor_id: v.id, vendor_name: v.name, amount: Number(r.amount ?? 0), count: 1 });
      }
    }
    const top_vendors_mtd = Array.from(vendorAgg.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
      .map((v) => ({ ...v, amount: round2(v.amount) }));

    // ── Outstanding bills ──────────────────────────────────────
    const { data: outstandingBills } = await client
      .from('bills')
      .select('amount, paid_amount, status')
      .eq('tenant_id', tenantId)
      .in('status', ['unpaid', 'partial']);
    type BillRow = { amount: number; paid_amount: number; status: string };
    const outstanding_bills = { count: 0, total: 0 };
    for (const b of (outstandingBills ?? []) as BillRow[]) {
      outstanding_bills.count++;
      outstanding_bills.total += Number(b.amount ?? 0) - Number(b.paid_amount ?? 0);
    }
    outstanding_bills.total = round2(outstanding_bills.total);

    // ── Consumption: parts issued from stock to jobs ───────────
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const delivered = await this.aggregatePartsIssuedValues(client, tenantId, [
      ['today', dayStart, dayEnd],
      ['week', weekStart.toISOString(), new Date().toISOString()],
      ['month', monthStart.toISOString(), new Date().toISOString()],
      ['ytd', yearStart.toISOString(), new Date().toISOString()],
    ]);

    // ── Margin: revenue − cost ─────────────────────────────────
    // We compute both definitions:
    //   - issued: by parts_lines.issued_at (operational, near real-time)
    //   - invoiced: by invoice.invoice_date for the linked job card
    //     (accounting; lags but reflects actual billed revenue)
    const marginWindows: Array<[string, string, string]> = [
      ['today', dayStart, dayEnd],
      ['week', weekStart.toISOString(), new Date().toISOString()],
      ['month', monthStart.toISOString(), new Date().toISOString()],
      ['ytd', yearStart.toISOString(), new Date().toISOString()],
    ];
    const marginIssued = await this.aggregatePartsMargin(client, tenantId, marginWindows);
    const marginInvoicedWindows: Array<[string, string, string]> = [
      ['today', dayStartDate, todayDate],
      ['week', weekStartDate, todayDate],
      ['month', monthStartDate, todayDate],
      ['ytd', yearStart.toISOString().slice(0, 10), todayDate],
    ];
    const marginInvoiced = await this.aggregatePartsMarginByInvoice(client, tenantId, marginInvoicedWindows);
    const margin = { issued: marginIssued, invoiced: marginInvoiced };

    // ── WIP value: parts allocated to open job cards ───────────
    const { data: wipRows } = await client
      .from('wip_inventory')
      .select('cost_value')
      .eq('tenant_id', tenantId);
    let wip_value = 0;
    for (const r of (wipRows ?? []) as Array<{ cost_value: number | null }>) {
      wip_value += Number(r.cost_value ?? 0);
    }
    wip_value = round2(wip_value);

    // ── Top parts MTD by revenue ───────────────────────────────
    const { data: topPartRows } = await client
      .from('parts_lines')
      .select('part_number, part_name, quantity, subtotal')
      .eq('tenant_id', tenantId)
      .eq('stock_status', 'issued')
      .gte('issued_at', monthStart.toISOString());
    type TopRow = { part_number: string | null; part_name: string; quantity: number; subtotal: number };
    const topAgg = new Map<string, { part_number: string | null; description: string; quantity: number; revenue: number }>();
    for (const r of (topPartRows ?? []) as TopRow[]) {
      const key = (r.part_number && r.part_number.trim()) || `__${r.part_name}`;
      const e = topAgg.get(key);
      if (e) {
        e.quantity += Number(r.quantity ?? 0);
        e.revenue += Number(r.subtotal ?? 0);
      } else {
        topAgg.set(key, {
          part_number: r.part_number ?? null,
          description: r.part_name,
          quantity: Number(r.quantity ?? 0),
          revenue: Number(r.subtotal ?? 0),
        });
      }
    }
    const top_parts_mtd = Array.from(topAgg.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((p) => ({ ...p, revenue: round2(p.revenue) }));

    // ── Health: backorders (reserved > available) ──────────────
    let backorder_count = 0;
    for (const p of parts) {
      const available = Number(p.stock_qty ?? 0) - Number(p.reserved_qty ?? 0);
      if (available < 0) backorder_count++;
    }

    // ── Health: slow-moving (no `issued` in last 180 days) ─────
    const { data: movedRows } = await client
      .from('parts_lines')
      .select('part_number')
      .eq('tenant_id', tenantId)
      .eq('stock_status', 'issued')
      .gte('issued_at', new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString())
      .not('part_number', 'is', null);
    const movedKeys = new Set<string>();
    for (const m of movedRows ?? []) {
      const k = (m as { part_number: string | null }).part_number;
      if (k) movedKeys.add(k);
    }
    const { data: allParts } = await client
      .from('parts')
      .select('part_number, stock_qty, unit_cost')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .gt('stock_qty', 0);
    let slow_moving_value = 0;
    for (const p of (allParts ?? []) as Array<{ part_number: string | null; stock_qty: number; unit_cost: number }>) {
      const pn = p.part_number;
      if (pn && movedKeys.has(pn)) continue;
      slow_moving_value += Number(p.stock_qty ?? 0) * Number(p.unit_cost ?? 0);
    }
    slow_moving_value = round2(slow_moving_value);

    // ── Health: stock turnover (annualised COGS / avg stock value)
    // Approx: sum(parts_lines.unit_cost * quantity issued in last 365d)
    //         / current stock value
    const { data: issuedYear } = await client
      .from('parts_lines')
      .select('quantity, unit_cost')
      .eq('tenant_id', tenantId)
      .eq('stock_status', 'issued')
      .gte('issued_at', yearAgo.toISOString());
    let cogs365 = 0;
    for (const r of (issuedYear ?? []) as Array<{ quantity: number; unit_cost: number }>) {
      cogs365 += Number(r.quantity ?? 0) * Number(r.unit_cost ?? 0);
    }
    const stock_turnover = inventory.stock_value > 0
      ? round2(cogs365 / inventory.stock_value)
      : 0;

    return {
      inventory,
      procurement: {
        purchases,
        received,
        pending,
        top_vendors_mtd,
        outstanding_bills,
      },
      consumption: {
        delivered,
        margin,
        wip_value,
        top_parts_mtd,
      },
      health: {
        backorder_count,
        slow_moving_value,
        stock_turnover,
      },
      generated_at: now.toISOString(),
    };
  }

  private async aggregatePoLineValues(
    client: ReturnType<SupabaseService['getClient']>,
    tenantId: string,
    windows: Array<[string, string, string]>,
  ): Promise<Record<string, { count: number; amount: number }>> {
    const out: Record<string, { count: number; amount: number }> = {};
    for (const [label, start, end] of windows) {
      const { data } = await client
        .from('po_lines')
        .select('quantity, unit_cost, purchase_order:purchase_orders!inner(order_date)')
        .eq('tenant_id', tenantId)
        .gte('purchase_order.order_date', start)
        .lte('purchase_order.order_date', end);
      let amount = 0;
      const count = (data ?? []).length;
      for (const r of (data ?? []) as Array<{ quantity: number; unit_cost: number }>) {
        amount += Number(r.quantity ?? 0) * Number(r.unit_cost ?? 0);
      }
      out[label] = { count, amount: round2(amount) };
    }
    return out;
  }

  private async aggregateBillLineValues(
    client: ReturnType<SupabaseService['getClient']>,
    tenantId: string,
    windows: Array<[string, string, string]>,
  ): Promise<Record<string, { count: number; amount: number }>> {
    const out: Record<string, { count: number; amount: number }> = {};
    for (const [label, start, end] of windows) {
      const { data } = await client
        .from('bill_lines')
        .select('quantity, unit_cost, total, bill:bills!inner(bill_date, status)')
        .eq('tenant_id', tenantId)
        .gte('bill.bill_date', start)
        .lte('bill.bill_date', end);
      let amount = 0;
      const count = (data ?? []).length;
      for (const r of (data ?? []) as Array<{ quantity: number; unit_cost: number; total: number }>) {
        amount += Number(r.total ?? 0) || (Number(r.quantity ?? 0) * Number(r.unit_cost ?? 0));
      }
      out[label] = { count, amount: round2(amount) };
    }
    return out;
  }

  /**
   * Parts margin grouped by the cost method actually used at issue time.
   * Useful for spotting whether one method is systematically yielding
   * better/worse margins than another (e.g. FIFO during rising input
   * prices producing thinner margins than WAC).
   *
   * Returns one row per (cost_method) with revenue/cost/margin and the
   * count of lines, restricted to lines issued in the given window.
   */
  async partsMarginByCostMethod(
    tenantId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{
    cost_method: string;
    line_count: number;
    revenue: number;
    cost: number;
    margin: number;
    margin_pct: number;
  }>> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('parts_lines')
      .select('quantity, unit_cost, sell_price, subtotal, cost_method')
      .eq('tenant_id', tenantId)
      .eq('stock_status', 'issued')
      .gte('issued_at', startDate)
      .lte('issued_at', endDate);
    if (error) throw error;

    type Row = { quantity: number; unit_cost: number; sell_price: number; subtotal: number; cost_method: string | null };
    const buckets = new Map<string, { line_count: number; revenue: number; cost: number }>();
    for (const r of (data ?? []) as Row[]) {
      // Lines issued before migration 00121 have cost_method = null;
      // treat them as 'last_cost' (the old hardcoded behavior) so the
      // bucket label reflects what actually drove pricing at that time.
      const key = r.cost_method ?? 'last_cost';
      const qty = Number(r.quantity ?? 0);
      const revenue = Number(r.subtotal ?? 0) || qty * Number(r.sell_price ?? 0);
      const cost = qty * Number(r.unit_cost ?? 0);
      const cur = buckets.get(key) ?? { line_count: 0, revenue: 0, cost: 0 };
      cur.line_count++;
      cur.revenue += revenue;
      cur.cost += cost;
      buckets.set(key, cur);
    }
    return Array.from(buckets.entries())
      .map(([cost_method, b]) => {
        const margin = b.revenue - b.cost;
        return {
          cost_method,
          line_count: b.line_count,
          revenue: round2(b.revenue),
          cost: round2(b.cost),
          margin: round2(margin),
          margin_pct: b.revenue > 0 ? round2((margin / b.revenue) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  private async aggregatePartsMargin(
    client: ReturnType<SupabaseService['getClient']>,
    tenantId: string,
    windows: Array<[string, string, string]>,
  ): Promise<Record<string, { revenue: number; cost: number; margin: number; margin_pct: number }>> {
    const out: Record<string, { revenue: number; cost: number; margin: number; margin_pct: number }> = {};
    for (const [label, start, end] of windows) {
      const { data } = await client
        .from('parts_lines')
        .select('quantity, unit_cost, sell_price, subtotal')
        .eq('tenant_id', tenantId)
        .eq('stock_status', 'issued')
        .gte('issued_at', start)
        .lte('issued_at', end);
      let revenue = 0;
      let cost = 0;
      for (const r of (data ?? []) as Array<{ quantity: number; unit_cost: number; sell_price: number; subtotal: number }>) {
        const qty = Number(r.quantity ?? 0);
        revenue += Number(r.subtotal ?? 0) || qty * Number(r.sell_price ?? 0);
        cost += qty * Number(r.unit_cost ?? 0);
      }
      const margin = revenue - cost;
      const margin_pct = revenue > 0 ? (margin / revenue) * 100 : 0;
      out[label] = {
        revenue: round2(revenue),
        cost: round2(cost),
        margin: round2(margin),
        margin_pct: round2(margin_pct),
      };
    }
    return out;
  }

  /**
   * Margin by *invoice* date — joins parts_lines to invoiced job cards
   * via the invoices table. This is the accounting view of parts sales.
   */
  private async aggregatePartsMarginByInvoice(
    client: ReturnType<SupabaseService['getClient']>,
    tenantId: string,
    windows: Array<[string, string, string]>,
  ): Promise<Record<string, { revenue: number; cost: number; margin: number; margin_pct: number }>> {
    const out: Record<string, { revenue: number; cost: number; margin: number; margin_pct: number }> = {};
    for (const [label, start, end] of windows) {
      const { data: invs } = await client
        .from('invoices')
        .select('job_card_id, invoice_date')
        .eq('tenant_id', tenantId)
        .gte('invoice_date', start)
        .lte('invoice_date', end)
        .not('job_card_id', 'is', null);
      const jobIds = Array.from(
        new Set(
          (invs ?? [])
            .map((i) => (i as { job_card_id: string | null }).job_card_id)
            .filter((id): id is string => !!id),
        ),
      );
      if (jobIds.length === 0) {
        out[label] = { revenue: 0, cost: 0, margin: 0, margin_pct: 0 };
        continue;
      }
      const { data } = await client
        .from('parts_lines')
        .select('quantity, unit_cost, sell_price, subtotal')
        .eq('tenant_id', tenantId)
        .in('job_card_id', jobIds);
      let revenue = 0;
      let cost = 0;
      for (const r of (data ?? []) as Array<{ quantity: number; unit_cost: number; sell_price: number; subtotal: number }>) {
        const qty = Number(r.quantity ?? 0);
        revenue += Number(r.subtotal ?? 0) || qty * Number(r.sell_price ?? 0);
        cost += qty * Number(r.unit_cost ?? 0);
      }
      const margin = revenue - cost;
      const margin_pct = revenue > 0 ? (margin / revenue) * 100 : 0;
      out[label] = {
        revenue: round2(revenue),
        cost: round2(cost),
        margin: round2(margin),
        margin_pct: round2(margin_pct),
      };
    }
    return out;
  }

  private async aggregatePartsIssuedValues(
    client: ReturnType<SupabaseService['getClient']>,
    tenantId: string,
    windows: Array<[string, string, string]>,
  ): Promise<Record<string, { count: number; amount: number }>> {
    const out: Record<string, { count: number; amount: number }> = {};
    for (const [label, start, end] of windows) {
      const { data } = await client
        .from('parts_lines')
        .select('quantity, sell_price, subtotal')
        .eq('tenant_id', tenantId)
        .eq('stock_status', 'issued')
        .gte('issued_at', start)
        .lte('issued_at', end);
      let amount = 0;
      const count = (data ?? []).length;
      for (const r of (data ?? []) as Array<{ quantity: number; sell_price: number; subtotal: number }>) {
        amount += Number(r.subtotal ?? 0) || (Number(r.quantity ?? 0) * Number(r.sell_price ?? 0));
      }
      out[label] = { count, amount: round2(amount) };
    }
    return out;
  }

  /**
   * Pareto/ABC analysis by revenue over the window.
   *   Class A — top 80% of cumulative revenue (the vital few)
   *   Class B — next 15%
   *   Class C — bottom 5%
   */
  async abcAnalysis(tenantId: string, startDate: string, endDate: string) {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('parts_lines')
      .select('part_number, part_name, quantity, sell_price, subtotal')
      .eq('tenant_id', tenantId)
      .eq('stock_status', 'issued')
      .gte('issued_at', startDate)
      .lte('issued_at', endDate);
    if (error) throw error;

    type Row = { part_number: string | null; part_name: string; quantity: number; sell_price: number; subtotal: number };

    const agg = new Map<string, { part_number: string | null; description: string; quantity: number; revenue: number }>();
    for (const r of (data ?? []) as Row[]) {
      const key = (r.part_number && r.part_number.trim()) || `__${r.part_name}`;
      const revenue = Number(r.subtotal) || Number(r.sell_price) * Number(r.quantity) || 0;
      const existing = agg.get(key);
      if (existing) {
        existing.quantity += Number(r.quantity) || 0;
        existing.revenue += revenue;
      } else {
        agg.set(key, {
          part_number: r.part_number ?? null,
          description: r.part_name,
          quantity: Number(r.quantity) || 0,
          revenue,
        });
      }
    }

    const items = Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue);
    const total = items.reduce((s, i) => s + i.revenue, 0);

    let running = 0;
    const rows = items.map((it, idx) => {
      running += it.revenue;
      const cumPct = total > 0 ? (running / total) * 100 : 0;
      const itemPct = total > 0 ? (it.revenue / total) * 100 : 0;
      const cls: 'A' | 'B' | 'C' = cumPct <= 80 ? 'A' : cumPct <= 95 ? 'B' : 'C';
      return {
        rank: idx + 1,
        part_number: it.part_number,
        description: it.description,
        quantity: it.quantity,
        revenue: round2(it.revenue),
        revenue_pct: round2(itemPct),
        cumulative_pct: round2(cumPct),
        class: cls,
      };
    });

    const sumClass = (cls: 'A' | 'B' | 'C') =>
      rows.filter((r) => r.class === cls).reduce((s, r) => s + r.revenue, 0);

    const summary = {
      total_revenue: round2(total),
      total_items: rows.length,
      class_A: { items: rows.filter((r) => r.class === 'A').length, revenue: round2(sumClass('A')) },
      class_B: { items: rows.filter((r) => r.class === 'B').length, revenue: round2(sumClass('B')) },
      class_C: { items: rows.filter((r) => r.class === 'C').length, revenue: round2(sumClass('C')) },
    };

    return { rows, summary };
  }
}
