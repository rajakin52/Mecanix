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
}
