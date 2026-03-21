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

    const { data: entries, error } = await client
      .from('time_entries')
      .select('technician_id, total_seconds, job_card_id, technician:technicians(full_name)')
      .eq('tenant_id', tenantId)
      .gte('started_at', startDate)
      .lte('started_at', endDate);

    if (error) throw error;

    const techMap = new Map<
      string,
      { technicianName: string; totalSeconds: number; jobIds: Set<string> }
    >();

    for (const row of entries ?? []) {
      const techId = row.technician_id as string;
      const techName =
        (row.technician as unknown as { full_name: string } | null)?.full_name ?? 'Unknown';

      if (!techMap.has(techId)) {
        techMap.set(techId, {
          technicianName: techName,
          totalSeconds: 0,
          jobIds: new Set(),
        });
      }

      const entry = techMap.get(techId)!;
      entry.totalSeconds += (row.total_seconds as number) || 0;
      if (row.job_card_id) {
        entry.jobIds.add(row.job_card_id as string);
      }
    }

    return Array.from(techMap.values()).map((t) => ({
      technicianName: t.technicianName,
      totalHours: round2(t.totalSeconds / 3600),
      jobsCount: t.jobIds.size,
    }));
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
      .select('id, balance_due, due_date, created_at')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("paid","cancelled")');

    if (error) throw error;

    const now = new Date();
    const buckets = {
      current: { count: 0, totalAmount: 0 },
      thirtyDays: { count: 0, totalAmount: 0 },
      sixtyDays: { count: 0, totalAmount: 0 },
      ninetyPlus: { count: 0, totalAmount: 0 },
    };

    for (const row of invoices ?? []) {
      const balanceDue = (row.balance_due as number) || 0;
      const dueDate = row.due_date ? new Date(row.due_date as string) : null;

      if (!dueDate || dueDate >= now) {
        buckets.current.count++;
        buckets.current.totalAmount += balanceDue;
      } else {
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysOverdue <= 30) {
          buckets.thirtyDays.count++;
          buckets.thirtyDays.totalAmount += balanceDue;
        } else if (daysOverdue <= 60) {
          buckets.sixtyDays.count++;
          buckets.sixtyDays.totalAmount += balanceDue;
        } else {
          buckets.ninetyPlus.count++;
          buckets.ninetyPlus.totalAmount += balanceDue;
        }
      }
    }

    // Round amounts
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

    return { ...buckets, total };
  }

  async outstandingBillsReport(tenantId: string) {
    const client = this.supabase.getClient();

    const { data: bills, error } = await client
      .from('bills')
      .select('id, amount, paid_amount, due_date, created_at')
      .eq('tenant_id', tenantId)
      .neq('status', 'paid');

    if (error) throw error;

    const now = new Date();
    const buckets = {
      current: { count: 0, totalAmount: 0 },
      thirtyDays: { count: 0, totalAmount: 0 },
      sixtyDays: { count: 0, totalAmount: 0 },
      ninetyPlus: { count: 0, totalAmount: 0 },
    };

    for (const row of bills ?? []) {
      const amount = (row.amount as number) || 0;
      const paidAmount = (row.paid_amount as number) || 0;
      const outstanding = amount - paidAmount;
      const dueDate = row.due_date ? new Date(row.due_date as string) : null;

      if (!dueDate || dueDate >= now) {
        buckets.current.count++;
        buckets.current.totalAmount += outstanding;
      } else {
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysOverdue <= 30) {
          buckets.thirtyDays.count++;
          buckets.thirtyDays.totalAmount += outstanding;
        } else if (daysOverdue <= 60) {
          buckets.sixtyDays.count++;
          buckets.sixtyDays.totalAmount += outstanding;
        } else {
          buckets.ninetyPlus.count++;
          buckets.ninetyPlus.totalAmount += outstanding;
        }
      }
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

    return { ...buckets, total };
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
}
