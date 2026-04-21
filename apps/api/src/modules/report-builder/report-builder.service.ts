import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ReportTemplate {
  type: string;
  name: string;
  description: string;
  filters: Array<{ key: string; label: string; type: 'date' | 'string' | 'branch' }>;
  columns: Array<{ key: string; label: string; format?: 'currency' | 'integer' | 'date' | 'percent' }>;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    type: 'revenue_by_month',
    name: 'Revenue by month',
    description: 'Invoiced revenue grouped by month of invoice date.',
    filters: [
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate', label: 'To', type: 'date' },
      { key: 'branchId', label: 'Branch', type: 'branch' },
    ],
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'invoice_count', label: 'Invoices', format: 'integer' },
      { key: 'subtotal', label: 'Subtotal', format: 'currency' },
      { key: 'tax', label: 'Tax', format: 'currency' },
      { key: 'grand_total', label: 'Grand total', format: 'currency' },
    ],
  },
  {
    type: 'jobs_by_status_by_month',
    name: 'Jobs by status (by month)',
    description: 'Count of job cards grouped by month and status.',
    filters: [
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate', label: 'To', type: 'date' },
      { key: 'branchId', label: 'Branch', type: 'branch' },
    ],
    columns: [
      { key: 'month', label: 'Month' },
      { key: 'status', label: 'Status' },
      { key: 'count', label: 'Jobs', format: 'integer' },
    ],
  },
  {
    type: 'customer_revenue_ranking',
    name: 'Customer revenue ranking',
    description: 'Top customers by invoiced revenue in the selected period.',
    filters: [
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate', label: 'To', type: 'date' },
      { key: 'branchId', label: 'Branch', type: 'branch' },
    ],
    columns: [
      { key: 'customer_name', label: 'Customer' },
      { key: 'invoice_count', label: 'Invoices', format: 'integer' },
      { key: 'total_revenue', label: 'Revenue', format: 'currency' },
      { key: 'avg_invoice', label: 'Avg invoice', format: 'currency' },
    ],
  },
  {
    type: 'parts_consumption',
    name: 'Parts consumption',
    description: 'Parts issued to jobs grouped by part number.',
    filters: [
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate', label: 'To', type: 'date' },
    ],
    columns: [
      { key: 'part_number', label: 'Part #' },
      { key: 'part_name', label: 'Part' },
      { key: 'qty', label: 'Qty', format: 'integer' },
      { key: 'revenue', label: 'Revenue', format: 'currency' },
    ],
  },
  {
    type: 'technician_productivity_period',
    name: 'Technician productivity',
    description: 'Billed vs clocked hours per technician.',
    filters: [
      { key: 'startDate', label: 'From', type: 'date' },
      { key: 'endDate', label: 'To', type: 'date' },
    ],
    columns: [
      { key: 'technician', label: 'Technician' },
      { key: 'clocked_hours', label: 'Clocked', format: 'integer' },
      { key: 'billed_hours', label: 'Billed', format: 'integer' },
      { key: 'productivity_pct', label: 'Productivity', format: 'percent' },
      { key: 'revenue', label: 'Revenue', format: 'currency' },
    ],
  },
];

@Injectable()
export class ReportBuilderService {
  constructor(private readonly supabase: SupabaseService) {}

  listTemplates(): ReportTemplate[] {
    return REPORT_TEMPLATES;
  }

  async run(
    tenantId: string,
    reportType: string,
    filters: Record<string, unknown>,
  ): Promise<{ rows: Array<Record<string, unknown>>; columns: ReportTemplate['columns']; name: string }> {
    const tpl = REPORT_TEMPLATES.find((t) => t.type === reportType);
    if (!tpl) throw new BadRequestException(`Unknown report type: ${reportType}`);

    const rows = await this.execute(tenantId, reportType, filters);
    return { rows, columns: tpl.columns, name: tpl.name };
  }

  private async execute(
    tenantId: string,
    reportType: string,
    filters: Record<string, unknown>,
  ): Promise<Array<Record<string, unknown>>> {
    const client = this.supabase.getClient();
    const start = (filters.startDate as string) || null;
    const end = (filters.endDate as string) || null;
    const branchId = (filters.branchId as string) || null;

    switch (reportType) {
      case 'revenue_by_month': {
        let q = client
          .from('invoices')
          .select('invoice_date, subtotal, tax_amount, grand_total, job_card:job_cards(branch_id)')
          .eq('tenant_id', tenantId)
          .not('status', 'in', '("draft","cancelled")');
        if (start) q = q.gte('invoice_date', start);
        if (end) q = q.lte('invoice_date', end);
        const { data, error } = await q;
        if (error) throw error;

        const byMonth = new Map<string, { month: string; invoice_count: number; subtotal: number; tax: number; grand_total: number }>();
        for (const row of data ?? []) {
          if (branchId) {
            const jc = Array.isArray(row.job_card) ? row.job_card[0] : row.job_card;
            const bid = jc ? (jc as { branch_id?: string }).branch_id : null;
            if (bid !== branchId) continue;
          }
          const month = ((row.invoice_date as string | null) ?? '').slice(0, 7);
          if (!month) continue;
          const cur = byMonth.get(month) ?? { month, invoice_count: 0, subtotal: 0, tax: 0, grand_total: 0 };
          cur.invoice_count += 1;
          cur.subtotal += Number(row.subtotal) || 0;
          cur.tax += Number(row.tax_amount) || 0;
          cur.grand_total += Number(row.grand_total) || 0;
          byMonth.set(month, cur);
        }
        return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month));
      }

      case 'jobs_by_status_by_month': {
        let q = client
          .from('job_cards')
          .select('created_at, status, branch_id')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null);
        if (start) q = q.gte('created_at', start);
        if (end) q = q.lte('created_at', end);
        if (branchId) q = q.eq('branch_id', branchId);
        const { data, error } = await q;
        if (error) throw error;

        const buckets = new Map<string, number>();
        for (const row of data ?? []) {
          const month = ((row.created_at as string | null) ?? '').slice(0, 7);
          const status = (row.status as string | null) ?? 'unknown';
          const key = `${month}|${status}`;
          buckets.set(key, (buckets.get(key) ?? 0) + 1);
        }
        return Array.from(buckets.entries())
          .map(([key, count]) => {
            const parts = key.split('|');
            return { month: parts[0] ?? '', status: parts[1] ?? '', count };
          })
          .sort((a, b) => (a.month + a.status).localeCompare(b.month + b.status));
      }

      case 'customer_revenue_ranking': {
        let q = client
          .from('invoices')
          .select('customer_id, grand_total, customer:customers(full_name), job_card:job_cards(branch_id)')
          .eq('tenant_id', tenantId)
          .not('status', 'in', '("draft","cancelled")');
        if (start) q = q.gte('invoice_date', start);
        if (end) q = q.lte('invoice_date', end);
        const { data, error } = await q;
        if (error) throw error;

        const byCustomer = new Map<string, { customer_name: string; invoice_count: number; total_revenue: number; avg_invoice: number }>();
        for (const row of data ?? []) {
          if (branchId) {
            const jc = Array.isArray(row.job_card) ? row.job_card[0] : row.job_card;
            const bid = jc ? (jc as { branch_id?: string }).branch_id : null;
            if (bid !== branchId) continue;
          }
          const id = (row.customer_id as string | null) ?? 'unknown';
          const cust = Array.isArray(row.customer) ? row.customer[0] : row.customer;
          const name = ((cust as { full_name?: string } | null)?.full_name) ?? 'Unknown';
          const cur = byCustomer.get(id) ?? { customer_name: name, invoice_count: 0, total_revenue: 0, avg_invoice: 0 };
          cur.invoice_count += 1;
          cur.total_revenue += Number(row.grand_total) || 0;
          cur.avg_invoice = cur.total_revenue / cur.invoice_count;
          byCustomer.set(id, cur);
        }
        return Array.from(byCustomer.values())
          .sort((a, b) => b.total_revenue - a.total_revenue)
          .slice(0, 100);
      }

      case 'parts_consumption': {
        let q = client
          .from('parts_lines')
          .select('part_number, part_name, quantity, subtotal, issued_at')
          .eq('tenant_id', tenantId)
          .eq('stock_status', 'issued');
        if (start) q = q.gte('issued_at', start);
        if (end) q = q.lte('issued_at', end);
        const { data, error } = await q;
        if (error) throw error;

        const byPart = new Map<string, { part_number: string; part_name: string; qty: number; revenue: number }>();
        for (const row of data ?? []) {
          const key = (row.part_number as string | null) ?? (row.part_name as string | null) ?? 'Unknown';
          const cur = byPart.get(key) ?? {
            part_number: (row.part_number as string | null) ?? '',
            part_name: (row.part_name as string | null) ?? '',
            qty: 0,
            revenue: 0,
          };
          cur.qty += Number(row.quantity) || 0;
          cur.revenue += Number(row.subtotal) || 0;
          byPart.set(key, cur);
        }
        return Array.from(byPart.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 200);
      }

      case 'technician_productivity_period': {
        const startIso = start ? new Date(start).toISOString() : null;
        const endIso = end ? new Date(end).toISOString() : null;

        const { data: timeEntries } = await client
          .from('time_entries')
          .select('technician_id, total_seconds, technician:technicians(full_name)')
          .eq('tenant_id', tenantId)
          .gte('started_at', startIso ?? '1970-01-01')
          .lte('started_at', endIso ?? '2099-12-31');

        const { data: labourLines } = await client
          .from('labour_lines')
          .select('technician_id, hours, subtotal')
          .eq('tenant_id', tenantId)
          .eq('line_status', 'charged')
          .not('technician_id', 'is', null)
          .gte('created_at', startIso ?? '1970-01-01')
          .lte('created_at', endIso ?? '2099-12-31');

        type Row = { technician: string; clocked_hours: number; billed_hours: number; revenue: number; productivity_pct: number };
        const byTech = new Map<string, Row>();

        for (const e of timeEntries ?? []) {
          const id = e.technician_id as string;
          const name = ((Array.isArray(e.technician) ? e.technician[0] : e.technician) as { full_name?: string } | null)?.full_name ?? 'Unknown';
          const cur = byTech.get(id) ?? { technician: name, clocked_hours: 0, billed_hours: 0, revenue: 0, productivity_pct: 0 };
          cur.clocked_hours += (Number(e.total_seconds) || 0) / 3600;
          byTech.set(id, cur);
        }
        for (const l of labourLines ?? []) {
          const id = l.technician_id as string | null;
          if (!id) continue;
          const cur = byTech.get(id) ?? { technician: 'Unknown', clocked_hours: 0, billed_hours: 0, revenue: 0, productivity_pct: 0 };
          cur.billed_hours += Number(l.hours) || 0;
          cur.revenue += Number(l.subtotal) || 0;
          byTech.set(id, cur);
        }

        return Array.from(byTech.values())
          .map((r) => ({
            ...r,
            clocked_hours: Math.round(r.clocked_hours * 10) / 10,
            billed_hours: Math.round(r.billed_hours * 10) / 10,
            revenue: Math.round(r.revenue * 100) / 100,
            productivity_pct: r.clocked_hours > 0 ? Math.round((r.billed_hours / r.clocked_hours) * 100) : 0,
          }))
          .sort((a, b) => b.revenue - a.revenue);
      }

      default:
        throw new BadRequestException(`Unsupported report type: ${reportType}`);
    }
  }

  // ── Saved reports CRUD ───────────────────────────────────────

  async list(tenantId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('saved_reports')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getById(tenantId: string, id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('saved_reports')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (error || !data) throw new NotFoundException('Report not found');
    return data;
  }

  async save(
    tenantId: string,
    userId: string,
    input: { name: string; description?: string; reportType: string; filters: Record<string, unknown> },
  ) {
    const { data, error } = await this.supabase
      .getClient()
      .from('saved_reports')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        description: input.description ?? null,
        report_type: input.reportType,
        filters: input.filters ?? {},
        created_by: userId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(
    tenantId: string,
    id: string,
    input: { name?: string; description?: string | null; filters?: Record<string, unknown> },
  ) {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.filters !== undefined) patch.filters = input.filters;

    const { data, error } = await this.supabase
      .getClient()
      .from('saved_reports')
      .update(patch)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(tenantId: string, id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('saved_reports')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);
    if (error) throw error;
    return { deleted: true };
  }

  // ── CSV export ───────────────────────────────────────────────

  toCsv(columns: ReportTemplate['columns'], rows: Array<Record<string, unknown>>): string {
    const escape = (v: unknown): string => {
      if (v == null) return '';
      const str = String(v);
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const header = columns.map((c) => escape(c.label)).join(',');
    const body = rows.map((r) => columns.map((c) => escape(r[c.key])).join(',')).join('\n');
    return `${header}\n${body}`;
  }
}
