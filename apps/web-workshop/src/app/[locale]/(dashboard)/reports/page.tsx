'use client';

import React, { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2 } from 'lucide-react';
import { useToast } from '@mecanix/ui-web';
import { Link } from '@/i18n/navigation';
import { useFormat } from '@/hooks/use-format';
import { api } from '@/lib/api';
import { ReportSection } from '@/components/reports/ReportSection';
import { SearchableSelect } from '@/components/SearchableSelect';
import { useCustomers } from '@/hooks/use-customers';
import { useCustomerStatement, useCustomerBalances, useAgingReceivables } from '@/hooks/use-reports';
import type { AgingCustomerGroup, AgingReceivableRow } from '@/hooks/use-reports';
import { formatDate } from '@/lib/format';
import {
  useRevenueReport,
  useJobCardReport,
  useTechnicianReport,
  usePartsUsageReport,
  useOutstandingInvoices,
  useOutstandingBills,
  useExpenseReport,
  useIncomeExpenseReport,
  useInsuranceReport,
  useCustomerRetentionReport,
  useInventoryValuationReport,
  useStockMovementsReport,
  useLowStockReport,
  usePurchaseRequestSummaryReport,
  useVendorPerformanceReport,
  useWipInventoryReport,
} from '@/hooks/use-reports';

type ReportType =
  | 'revenue'
  | 'jobCards'
  | 'technicians'
  | 'partsUsage'
  | 'outstandingInvoices'
  | 'outstandingBills'
  | 'customerStatement'
  | 'agingReceivables'
  | 'expensesByCategory'
  | 'incomeVsExpense'
  | 'insuranceClaims'
  | 'customerRetention'
  | 'creditNotes'
  | 'inventoryValuation'
  | 'stockMovements'
  | 'lowStock'
  | 'purchaseRequestSummary'
  | 'vendorPerformance'
  | 'wipInventory';

export default function ReportsPage() {
  const t = useTranslations('reports');
  const { money, moneyWhole } = useFormat();

  const [selectedReport, setSelectedReport] = useState<ReportType>('revenue');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  // Outstanding reports used to be pure snapshots; now they support an
  // optional date filter (defaults to All dates) + an ageing bucket
  // filter so the user can isolate, say, "everything >60 days overdue".
  const isOutstandingReport =
    selectedReport === 'outstandingInvoices' || selectedReport === 'outstandingBills';
  const [agingFilter, setAgingFilter] = useState<'all' | '0' | '30' | '60' | '90'>('all');

  const reportOptions: { value: ReportType; label: string }[] = [
    { value: 'revenue', label: t('revenue') },
    { value: 'jobCards', label: t('jobCards') },
    { value: 'technicians', label: t('technicians') },
    { value: 'partsUsage', label: t('partsUsage') },
    { value: 'outstandingInvoices', label: t('outstandingInvoices') },
    { value: 'outstandingBills', label: t('outstandingBills') },
    { value: 'customerStatement', label: 'Statement of Account' },
    { value: 'agingReceivables', label: 'Aging of Receivables' },
    { value: 'expensesByCategory', label: t('expensesByCategory') },
    { value: 'incomeVsExpense', label: t('incomeVsExpense') },
    { value: 'insuranceClaims', label: t('insuranceClaims') },
    { value: 'customerRetention', label: t('customerRetention') },
    { value: 'creditNotes', label: t('creditNotes') },
    { value: 'inventoryValuation', label: t('inventoryValuation') },
    { value: 'stockMovements', label: t('stockMovements') },
    { value: 'lowStock', label: t('lowStock') },
    { value: 'purchaseRequestSummary', label: t('purchaseRequestSummary') },
    { value: 'vendorPerformance', label: t('vendorPerformance') },
    { value: 'wipInventory', label: t('wipInventory') },
  ];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <div className="flex gap-2">
          <Link
            href="/reports/builder"
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            Report builder &rarr;
          </Link>
          <Link
            href="/reports/tax"
            className="rounded-md border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50"
          >
            Tax Reports &rarr;
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('selectReport')}
          </label>
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value as ReportType)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {reportOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('from')}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t('to')}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {isOutstandingReport && (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Age</label>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {([
                ['all', 'All'],
                ['0', '>0d'],
                ['30', '>30d'],
                ['60', '>60d'],
                ['90', '>90d'],
              ] as Array<[typeof agingFilter, string]>).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAgingFilter(k)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    agingFilter === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="self-end text-xs font-medium text-gray-600 hover:text-gray-900"
            title="Clear date range"
          >
            Clear dates
          </button>
        )}
      </div>

      {/* Report Content */}
      <div className="mt-8">
        {selectedReport === 'revenue' && (
          <RevenueSection startDate={startDate} endDate={endDate} money={money} t={t} />
        )}
        {selectedReport === 'jobCards' && (
          <JobCardsSection startDate={startDate} endDate={endDate} t={t} />
        )}
        {selectedReport === 'technicians' && (
          <TechniciansSection startDate={startDate} endDate={endDate} t={t} />
        )}
        {selectedReport === 'partsUsage' && (
          <PartsUsageSection startDate={startDate} endDate={endDate} money={money} t={t} />
        )}
        {selectedReport === 'outstandingInvoices' && (
          <OutstandingInvoicesSection
            money={money}
            moneyWhole={moneyWhole}
            startDate={startDate}
            endDate={endDate}
            agingFilter={agingFilter}
            t={t}
          />
        )}
        {selectedReport === 'outstandingBills' && (
          <OutstandingBillsSection
            money={money}
            moneyWhole={moneyWhole}
            startDate={startDate}
            endDate={endDate}
            agingFilter={agingFilter}
            t={t}
          />
        )}
        {selectedReport === 'customerStatement' && (
          <CustomerStatementSection
            money={money}
            moneyWhole={moneyWhole}
            startDate={startDate}
            endDate={endDate}
            t={t}
          />
        )}
        {selectedReport === 'agingReceivables' && (
          <AgingReceivablesSection money={money} moneyWhole={moneyWhole} t={t} />
        )}
        {selectedReport === 'expensesByCategory' && (
          <ExpensesSection startDate={startDate} endDate={endDate} money={money} t={t} />
        )}
        {selectedReport === 'incomeVsExpense' && (
          <IncomeExpenseSection startDate={startDate} endDate={endDate} money={money} t={t} />
        )}
        {selectedReport === 'insuranceClaims' && (
          <InsuranceSection startDate={startDate} endDate={endDate} money={money} t={t} />
        )}
        {selectedReport === 'customerRetention' && (
          <CustomerRetentionSection startDate={startDate} endDate={endDate} t={t} />
        )}
        {selectedReport === 'creditNotes' && (
          <CreditNotesSection startDate={startDate} endDate={endDate} money={money} t={t} />
        )}
        {selectedReport === 'inventoryValuation' && (
          <InventoryValuationSection money={money} t={t} />
        )}
        {selectedReport === 'stockMovements' && (
          <StockMovementsSection startDate={startDate} endDate={endDate} t={t} />
        )}
        {selectedReport === 'lowStock' && (
          <LowStockSection t={t} />
        )}
        {selectedReport === 'purchaseRequestSummary' && (
          <PurchaseRequestSummarySection startDate={startDate} endDate={endDate} money={money} t={t} />
        )}
        {selectedReport === 'vendorPerformance' && (
          <VendorPerformanceSection startDate={startDate} endDate={endDate} money={money} t={t} />
        )}
        {selectedReport === 'wipInventory' && (
          <WipInventorySection money={money} t={t} />
        )}
      </div>
    </div>
  );
}

/* ────────── Shared helpers ────────── */

type TFn = ReturnType<typeof useTranslations>;
type MoneyFn = (v: number | string | null | undefined) => string;

function Card({ label, value, className }: { label: string; value: string | number; className?: string }) {
  return (
    <div className={`rounded-lg border border-gray-200 bg-white p-6 shadow-sm ${className ?? ''}`}>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function NoData({ t }: { t: TFn }) {
  return <p className="text-sm text-gray-400">{t('noData')}</p>;
}

function dateRangeLabel(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return 'All dates';
  if (startDate && endDate) return `${startDate} → ${endDate}`;
  if (startDate) return `From ${startDate}`;
  return `Up to ${endDate}`;
}

/* ────────── Revenue ────────── */

function RevenueSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useRevenueReport(startDate || undefined, endDate || undefined);
  const d = data as Record<string, number> | undefined;

  const buildCsv = () => {
    if (!d) return null;
    return [
      ['Metric', 'Amount'],
      [t('totalInvoiced'), d.total_invoiced ?? 0],
      ['Labour', d.labour_total ?? 0],
      ['Parts', d.parts_total ?? 0],
      ['Tax', d.tax_total ?? 0],
      [t('paymentsReceived'), d.payments_received ?? 0],
    ];
  };

  return (
    <ReportSection
      title="Revenue"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'revenue', build: buildCsv }}
      disableExport={isLoading || !d}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card label={t('totalInvoiced')} value={money(d.total_invoiced ?? 0)} />
          <Card label="Labour" value={money(d.labour_total ?? 0)} />
          <Card label="Parts" value={money(d.parts_total ?? 0)} />
          <Card label="Tax" value={money(d.tax_total ?? 0)} />
          <Card label={t('paymentsReceived')} value={money(d.payments_received ?? 0)} />
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Job Cards ────────── */

function JobCardsSection({ startDate, endDate, t }: { startDate: string; endDate: string; t: TFn }) {
  const { data, isLoading } = useJobCardReport(startDate || undefined, endDate || undefined);
  const d = data as Record<string, unknown> | undefined;
  const statusBreakdown = (d?.by_status ?? d?.status_breakdown ?? {}) as Record<string, number>;

  const buildCsv = () => {
    if (!d) return null;
    return [
      ['Status', 'Count'],
      ['Total', Number(d.total ?? 0)],
      ...Object.entries(statusBreakdown).map(([s, c]) => [s, c]),
    ];
  };

  return (
    <ReportSection
      title="Job Cards"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'job-cards', build: buildCsv }}
      disableExport={isLoading || !d}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
        <div>
          <Card label="Total" value={String(d.total ?? 0)} className="mb-4 max-w-xs" />
          {Object.keys(statusBreakdown).length > 0 && (
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Status</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(statusBreakdown).map(([status, count]) => (
                    <tr key={status}>
                      <td className="px-4 py-2">
                        <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">{status}</span>
                      </td>
                      <td className="px-4 py-2 text-end font-medium">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Technicians ────────── */

function TechniciansSection({ startDate, endDate, t }: { startDate: string; endDate: string; t: TFn }) {
  const { data, isLoading } = useTechnicianReport(startDate || undefined, endDate || undefined);
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  const buildCsv = () => {
    if (rows.length === 0) return null;
    return [
      ['Name', 'Hours', 'Jobs'],
      ...rows.map((r) => [
        String(r.full_name ?? r.name ?? ''),
        Number(r.total_hours ?? r.hours ?? 0),
        Number(r.total_jobs ?? r.jobs ?? 0),
      ]),
    ];
  };

  return (
    <ReportSection
      title="Technicians"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'technicians', build: buildCsv }}
      disableExport={isLoading || rows.length === 0}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : rows.length === 0 ? (
        <NoData t={t} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Name</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Hours</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Jobs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-medium text-gray-900">{String(r.full_name ?? r.name ?? '-')}</td>
                  <td className="px-4 py-2 text-end text-gray-700">{String(r.total_hours ?? r.hours ?? 0)}</td>
                  <td className="px-4 py-2 text-end text-gray-700">{String(r.total_jobs ?? r.jobs ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Parts Usage ────────── */

function PartsUsageSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = usePartsUsageReport(startDate || undefined, endDate || undefined);
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  const buildCsv = () => {
    if (rows.length === 0) return null;
    return [
      ['Part #', 'Description', 'Quantity', 'Value'],
      ...rows.map((r) => [
        String(r.part_number ?? ''),
        String(r.description ?? ''),
        Number(r.total_qty ?? r.quantity ?? 0),
        Number(r.total_value ?? r.value ?? 0),
      ]),
    ];
  };

  return (
    <ReportSection
      title="Parts Usage"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'parts-usage', build: buildCsv }}
      disableExport={isLoading || rows.length === 0}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : rows.length === 0 ? (
        <NoData t={t} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Part</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Qty</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-medium text-gray-900">{String(r.description ?? r.part_number ?? '-')}</td>
                  <td className="px-4 py-2 text-end text-gray-700">{String(r.total_qty ?? r.quantity ?? 0)}</td>
                  <td className="px-4 py-2 text-end text-gray-700">{money(Number(r.total_value ?? r.value ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Outstanding Invoices ────────── */

interface OutstandingInvoiceRow {
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
}
interface AgingBucket { count: number; totalAmount: number }
interface OutstandingInvoicesData {
  current: AgingBucket;
  thirtyDays: AgingBucket;
  sixtyDays: AgingBucket;
  ninetyPlus: AgingBucket;
  total: AgingBucket;
  rows?: OutstandingInvoiceRow[];
}

function filterOutstandingRows<R extends { invoice_date?: string | null; bill_date?: string | null; due_date: string | null; days_overdue: number }>(
  rows: R[],
  startDate: string,
  endDate: string,
  agingFilter: 'all' | '0' | '30' | '60' | '90',
): R[] {
  const minOverdue = agingFilter === 'all' ? -Infinity : Number(agingFilter);
  return rows.filter((r) => {
    if (agingFilter !== 'all' && r.days_overdue < minOverdue) return false;
    // Optional date filter applies to invoice_date / bill_date if present
    const docDate = (r as { invoice_date?: string | null; bill_date?: string | null }).invoice_date
      ?? (r as { bill_date?: string | null }).bill_date
      ?? null;
    if (startDate && docDate && docDate < startDate) return false;
    if (endDate && docDate && docDate > endDate) return false;
    return true;
  });
}

function OutstandingInvoicesSection({
  money, moneyWhole, startDate, endDate, agingFilter, t,
}: {
  money: MoneyFn; moneyWhole: MoneyFn;
  startDate: string; endDate: string;
  agingFilter: 'all' | '0' | '30' | '60' | '90';
  t: TFn;
}) {
  const { data, isLoading } = useOutstandingInvoices();
  const d = data as OutstandingInvoicesData | undefined;

  const filteredRows = d?.rows ? filterOutstandingRows(d.rows, startDate, endDate, agingFilter) : [];
  // Recompute buckets from the filtered rows so KPIs match the visible table
  const recomputedBuckets = filteredRows.reduce(
    (acc, r) => {
      acc.total += r.balance_due;
      if (r.bucket === 'current') acc.current += r.balance_due;
      else if (r.bucket === '30') acc.thirty += r.balance_due;
      else if (r.bucket === '60') acc.sixty += r.balance_due;
      else acc.ninety += r.balance_due;
      return acc;
    },
    { total: 0, current: 0, thirty: 0, sixty: 0, ninety: 0 },
  );

  const buildCsv = () => {
    if (filteredRows.length === 0) return null;
    const rows: unknown[][] = [
      ['Invoice #', 'Customer', 'Phone', 'Invoice date', 'Due date', 'Status', 'Total', 'Paid', 'Balance due', 'Days overdue', 'Bucket'],
      ...filteredRows.map((r) => [
        r.invoice_number, r.customer_name ?? '', r.customer_phone ?? '',
        r.invoice_date ?? '', r.due_date ?? '', r.status,
        r.grand_total, r.paid_amount, r.balance_due, r.days_overdue, r.bucket,
      ]),
    ];
    return rows;
  };

  return (
    <ReportSection
      title="Outstanding Invoices"
      subtitle="Money customers owe you (AR). All dates by default — narrow by date or age."
      exportCsv={{ filename: 'outstanding-invoices', build: buildCsv }}
      disableExport={isLoading || filteredRows.length === 0}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card label="Total" value={moneyWhole(recomputedBuckets.total)} />
            <Card label="Current" value={moneyWhole(recomputedBuckets.current)} />
            <Card label="≤ 30 days" value={moneyWhole(recomputedBuckets.thirty)} />
            <Card label="≤ 60 days" value={moneyWhole(recomputedBuckets.sixty)} />
            <Card label="90+ days" value={moneyWhole(recomputedBuckets.ninety)} />
          </div>
          {filteredRows.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-start">Invoice</th>
                    <th className="px-3 py-2 text-start">Customer</th>
                    <th className="px-3 py-2 text-start">Due</th>
                    <th className="px-3 py-2 text-end">Days overdue</th>
                    <th className="px-3 py-2 text-end">Balance</th>
                    <th className="px-3 py-2 text-start">Bucket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map((r) => (
                    <tr key={r.id} className={r.bucket === '90+' ? 'bg-red-50/40' : r.bucket === '60' ? 'bg-amber-50/30' : ''}>
                      <td className="px-3 py-2 font-medium text-primary-600">{r.invoice_number}</td>
                      <td className="px-3 py-2 text-gray-700">{r.customer_name ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.due_date ?? '—'}</td>
                      <td className="px-3 py-2 text-end text-gray-700">{r.days_overdue || 0}</td>
                      <td className="px-3 py-2 text-end font-medium text-gray-900">{money(r.balance_due)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.bucket}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-green-700">No outstanding invoices. 🎉</p>
          )}
        </>
      )}
    </ReportSection>
  );
}

/* ────────── Outstanding Bills ────────── */

interface OutstandingBillRow {
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
}
interface OutstandingBillsData {
  current: AgingBucket;
  thirtyDays: AgingBucket;
  sixtyDays: AgingBucket;
  ninetyPlus: AgingBucket;
  total: AgingBucket;
  rows?: OutstandingBillRow[];
}

function OutstandingBillsSection({
  money, moneyWhole, startDate, endDate, agingFilter, t,
}: {
  money: MoneyFn; moneyWhole: MoneyFn;
  startDate: string; endDate: string;
  agingFilter: 'all' | '0' | '30' | '60' | '90';
  t: TFn;
}) {
  const { data, isLoading } = useOutstandingBills();
  const d = data as OutstandingBillsData | undefined;

  const filteredRows = d?.rows ? filterOutstandingRows(d.rows, startDate, endDate, agingFilter) : [];
  const recomputedBuckets = filteredRows.reduce(
    (acc, r) => {
      acc.total += r.outstanding;
      if (r.bucket === 'current') acc.current += r.outstanding;
      else if (r.bucket === '30') acc.thirty += r.outstanding;
      else if (r.bucket === '60') acc.sixty += r.outstanding;
      else acc.ninety += r.outstanding;
      return acc;
    },
    { total: 0, current: 0, thirty: 0, sixty: 0, ninety: 0 },
  );

  const buildCsv = () => {
    if (filteredRows.length === 0) return null;
    const rows: unknown[][] = [
      ['Bill #', 'Vendor', 'Bill date', 'Due date', 'Status', 'Amount', 'Paid', 'Outstanding', 'Days overdue', 'Bucket'],
      ...filteredRows.map((r) => [
        r.bill_number, r.vendor_name ?? '',
        r.bill_date ?? '', r.due_date ?? '', r.status,
        r.amount, r.paid_amount, r.outstanding, r.days_overdue, r.bucket,
      ]),
    ];
    return rows;
  };

  return (
    <ReportSection
      title="Outstanding Bills"
      subtitle="Money you owe suppliers (AP). All dates by default — narrow by date or age."
      exportCsv={{ filename: 'outstanding-bills', build: buildCsv }}
      disableExport={isLoading || filteredRows.length === 0}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card label="Total" value={moneyWhole(recomputedBuckets.total)} />
            <Card label="Current" value={moneyWhole(recomputedBuckets.current)} />
            <Card label="≤ 30 days" value={moneyWhole(recomputedBuckets.thirty)} />
            <Card label="≤ 60 days" value={moneyWhole(recomputedBuckets.sixty)} />
            <Card label="90+ days" value={moneyWhole(recomputedBuckets.ninety)} />
          </div>
          {filteredRows.length > 0 ? (
            <div className="overflow-hidden rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-start">Bill</th>
                    <th className="px-3 py-2 text-start">Vendor</th>
                    <th className="px-3 py-2 text-start">Due</th>
                    <th className="px-3 py-2 text-end">Days overdue</th>
                    <th className="px-3 py-2 text-end">Outstanding</th>
                    <th className="px-3 py-2 text-start">Bucket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map((r) => (
                    <tr key={r.id} className={r.bucket === '90+' ? 'bg-red-50/40' : r.bucket === '60' ? 'bg-amber-50/30' : ''}>
                      <td className="px-3 py-2 font-medium text-gray-900">{r.bill_number}</td>
                      <td className="px-3 py-2 text-gray-700">{r.vendor_name ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{r.due_date ?? '—'}</td>
                      <td className="px-3 py-2 text-end text-gray-700">{r.days_overdue || 0}</td>
                      <td className="px-3 py-2 text-end font-medium text-gray-900">{money(r.outstanding)}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{r.bucket}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-green-700">No outstanding bills. 🎉</p>
          )}
        </>
      )}
    </ReportSection>
  );
}

/* ────────── Expenses by Category ────────── */

function ExpensesSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useExpenseReport(startDate || undefined, endDate || undefined);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const total = rows.reduce((sum, r) => sum + Number(r.total ?? r.amount ?? 0), 0);

  const buildCsv = () => {
    if (rows.length === 0) return null;
    return [
      ['Category', 'Amount'],
      ...rows.map((r) => [String(r.category ?? ''), Number(r.total ?? r.amount ?? 0)]),
      ['Total', total],
    ];
  };

  return (
    <ReportSection
      title="Expenses by Category"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'expenses', build: buildCsv }}
      disableExport={isLoading || rows.length === 0}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : rows.length === 0 ? (
        <NoData t={t} />
      ) : (
        <div>
          <Card label="Total" value={money(total)} className="mb-4 max-w-xs" />
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Category</th>
                  <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-medium text-gray-900">{String(r.category ?? '-')}</td>
                    <td className="px-4 py-2 text-end text-gray-700">{money(Number(r.total ?? r.amount ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Income vs Expense ────────── */

function IncomeExpenseSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useIncomeExpenseReport(startDate || undefined, endDate || undefined);
  const d = data as Record<string, number> | undefined;
  const netProfit = d ? (d.income ?? 0) - (d.expenses ?? 0) - (d.bills ?? 0) : 0;
  const isPositive = netProfit >= 0;

  const buildCsv = () => {
    if (!d) return null;
    return [
      ['Metric', 'Amount'],
      ['Income', d.income ?? 0],
      ['Expenses', d.expenses ?? 0],
      ['Bills', d.bills ?? 0],
      ['Net profit', netProfit],
    ];
  };

  return (
    <ReportSection
      title="Income vs Expense"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'income-expense', build: buildCsv }}
      disableExport={isLoading || !d}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Income" value={money(d.income ?? 0)} />
          <Card label="Expenses" value={money(d.expenses ?? 0)} />
          <Card label="Bills" value={money(d.bills ?? 0)} />
          <div className={`rounded-lg border p-6 shadow-sm ${isPositive ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
            <p className="text-sm font-medium text-gray-500">{t('netProfit')}</p>
            <p className={`mt-2 text-2xl font-bold ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
              {money(netProfit)}
            </p>
          </div>
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Insurance ────────── */

function InsuranceSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useInsuranceReport(startDate || undefined, endDate || undefined);
  const d = data as Record<string, unknown> | undefined;
  const byStatus = (d?.by_status ?? {}) as Record<string, number>;

  const buildCsv = () => {
    if (!d) return null;
    return [
      ['Metric', 'Value'],
      ['Total claims', String(d.total_claims ?? 0)],
      ['Avg approval (hours)', String(d.avg_approval_time ?? d.avg_approval_hours ?? '')],
      ['Total approved (amount)', Number(d.total_approved ?? 0)],
      ...Object.entries(byStatus).map(([s, c]) => [`Status: ${s}`, c]),
    ];
  };

  return (
    <ReportSection
      title="Insurance"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'insurance', build: buildCsv }}
      disableExport={isLoading || !d}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Total claims" value={String(d.total_claims ?? 0)} />
            <Card label="Avg approval time" value={`${String(d.avg_approval_time ?? d.avg_approval_hours ?? '-')}h`} />
            <Card label="Total approved" value={money(Number(d.total_approved ?? 0))} />
          </div>
          {Object.keys(byStatus).length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Status</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Object.entries(byStatus).map(([status, count]) => (
                    <tr key={status}>
                      <td className="px-4 py-2 font-medium text-gray-900">{status}</td>
                      <td className="px-4 py-2 text-end text-gray-700">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Customer Retention ────────── */

function CustomerRetentionSection({ startDate, endDate, t }: { startDate: string; endDate: string; t: TFn }) {
  const { data, isLoading } = useCustomerRetentionReport(startDate || undefined, endDate || undefined);
  const d = data as Record<string, unknown> | undefined;
  const topCustomers = (d?.top_customers ?? []) as Array<Record<string, unknown>>;

  const buildCsv = () => {
    if (!d) return null;
    return [
      ['Section', 'Customer / Metric', 'Value'],
      ['Summary', 'Repeat customers', Number(d.repeat ?? 0)],
      ['Summary', 'New customers', Number(d.new ?? 0)],
      ['Summary', 'Total', Number(d.total ?? 0)],
      ...topCustomers.map((c) => ['Top customer', String(c.full_name ?? c.name ?? ''), Number(c.visits ?? c.count ?? 0)]),
    ];
  };

  return (
    <ReportSection
      title="Customer Retention"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'customer-retention', build: buildCsv }}
      disableExport={isLoading || !d}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card label="Repeat customers" value={String(d.repeat ?? 0)} />
            <Card label="New customers" value={String(d.new ?? 0)} />
            <Card label="Total" value={String(d.total ?? 0)} />
          </div>
          {topCustomers.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Customer</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Visits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topCustomers.slice(0, 10).map((c, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium text-gray-900">{String(c.full_name ?? c.name ?? '-')}</td>
                      <td className="px-4 py-2 text-end text-gray-700">{String(c.visits ?? c.count ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Credit Notes ────────── */

function CreditNotesSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useIncomeExpenseReport(startDate || undefined, endDate || undefined);
  const d = data as Record<string, unknown> | undefined;

  const buildCsv = () => {
    if (!d) return null;
    return [
      ['Metric', 'Value'],
      ['Count', Number(d.credit_notes_count ?? 0)],
      ['Total', Number(d.credit_notes_total ?? 0)],
    ];
  };

  return (
    <ReportSection
      title="Credit Notes"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'credit-notes', build: buildCsv }}
      disableExport={isLoading || !d}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
        <div className="grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
          <Card label="Count" value={String(d.credit_notes_count ?? 0)} />
          <Card label="Total" value={money(Number(d.credit_notes_total ?? 0))} />
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Inventory Valuation ────────── */

function InventoryValuationSection({ money, t }: { money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useInventoryValuationReport();
  const d = data as Record<string, unknown> | undefined;
  const summary = (d?.summary ?? {}) as Record<string, number>;
  const byCategory = (d?.byCategory ?? {}) as Record<string, Record<string, number>>;
  const byWarehouse = (d?.byWarehouse ?? {}) as Record<string, Record<string, unknown>>;

  const buildCsv = () => {
    if (!d) return null;
    const rows: unknown[][] = [
      ['Section', 'Bucket', 'SKUs', 'Units', 'Value'],
      ['Summary', 'All', summary.totalSkus ?? 0, summary.totalUnits ?? 0, summary.totalValue ?? 0],
    ];
    for (const [cat, c] of Object.entries(byCategory)) {
      rows.push(['Category', cat, c.skus ?? 0, c.units ?? 0, c.value ?? 0]);
    }
    for (const [, w] of Object.entries(byWarehouse)) {
      rows.push(['Warehouse', String(w.warehouseName ?? ''), '', Number(w.units ?? 0), Number(w.value ?? 0)]);
    }
    return rows;
  };

  return (
    <ReportSection
      title="Inventory Valuation"
      subtitle="Snapshot — current state, dates don’t apply."
      exportCsv={{ filename: 'inventory-valuation', build: buildCsv }}
      disableExport={isLoading || !d}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
            <Card label="Total SKUs" value={String(summary.totalSkus ?? 0)} />
            <Card label="Total Units" value={String(summary.totalUnits ?? 0)} />
            <Card label="Total Value" value={money(summary.totalValue ?? 0)} />
          </div>

          {Object.keys(byCategory).length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">By Category</h3>
              <div className="overflow-x-auto rounded-md border border-gray-200 mb-4">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Category</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">SKUs</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Units</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(byCategory).map(([cat, c]) => (
                      <tr key={cat}>
                        <td className="px-4 py-2 font-medium text-gray-900">{cat}</td>
                        <td className="px-4 py-2 text-end text-gray-700">{c.skus ?? 0}</td>
                        <td className="px-4 py-2 text-end text-gray-700">{c.units ?? 0}</td>
                        <td className="px-4 py-2 text-end text-gray-900">{money(c.value ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {Object.keys(byWarehouse).length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">By Warehouse</h3>
              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Warehouse</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Units</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(byWarehouse).map(([whId, w]) => (
                      <tr key={whId}>
                        <td className="px-4 py-2 font-medium text-gray-900">{String(w.warehouseName ?? '-')}</td>
                        <td className="px-4 py-2 text-end text-gray-700">{String(w.units ?? 0)}</td>
                        <td className="px-4 py-2 text-end text-gray-900">{money(Number(w.value ?? 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Stock Movements ────────── */

function StockMovementsSection({ startDate, endDate, t }: { startDate: string; endDate: string; t: TFn }) {
  const { data, isLoading } = useStockMovementsReport(startDate || undefined, endDate || undefined);
  const d = data as Record<string, unknown> | undefined;
  const summary = (d?.summary ?? {}) as Record<string, number>;
  const movements = (d?.movements ?? []) as Array<Record<string, unknown>>;

  const buildCsv = () => {
    if (!d) return null;
    return [
      ['Date', 'Part', 'Qty change', 'Reason', 'Reference', 'Adjusted by', 'Warehouse'],
      ...movements.map((m) => [
        m.createdAt ? new Date(m.createdAt as string).toISOString().slice(0, 10) : '',
        String(m.partDescription ?? ''),
        Number(m.quantityChange ?? 0),
        String(m.reason ?? ''),
        String(m.reference ?? ''),
        String(m.adjustedBy ?? ''),
        String(m.warehouse ?? ''),
      ]),
    ];
  };

  return (
    <ReportSection
      title="Stock Movements"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'stock-movements', build: buildCsv }}
      disableExport={isLoading || !d || movements.length === 0}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
            <Card label="Total In" value={String(summary.totalIn ?? 0)} className="border-green-200 bg-green-50" />
            <Card label="Total Out" value={String(summary.totalOut ?? 0)} className="border-red-200 bg-red-50" />
            <Card label="Net Change" value={String(summary.netChange ?? 0)} />
          </div>

          {movements.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Part</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Qty</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Reason</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Ref</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Adjusted by</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Warehouse</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m, i) => {
                    const qty = Number(m.quantityChange ?? 0);
                    return (
                      <tr key={i}>
                        <td className="px-4 py-2 font-medium text-gray-900">{String(m.partDescription ?? '-')}</td>
                        <td className={`px-4 py-2 text-end font-medium ${qty > 0 ? 'text-green-600' : qty < 0 ? 'text-red-600' : ''}`}>
                          {qty > 0 ? `+${qty}` : String(qty)}
                        </td>
                        <td className="px-4 py-2 text-gray-700">{String(m.reason ?? '-')}</td>
                        <td className="px-4 py-2 text-gray-700">{String(m.reference ?? '-')}</td>
                        <td className="px-4 py-2 text-gray-700">{String(m.adjustedBy ?? '-')}</td>
                        <td className="px-4 py-2 text-gray-700">{String(m.warehouse ?? '-')}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{m.createdAt ? new Date(m.createdAt as string).toLocaleDateString() : '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── Low Stock ────────── */

function LowStockSection({ t }: { t: TFn }) {
  const { data, isLoading } = useLowStockReport();
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  const buildCsv = () => {
    if (rows.length === 0) return null;
    return [
      ['Part #', 'Description', 'Stock', 'Reorder point', 'Deficit', 'Supplier', 'Last ordered'],
      ...rows.map((r) => [
        String(r.partNumber ?? ''),
        String(r.description ?? ''),
        Number(r.stockQty ?? 0),
        Number(r.reorderPoint ?? 0),
        Number(r.deficit ?? 0),
        String(r.supplierName ?? ''),
        r.lastOrderDate ? new Date(r.lastOrderDate as string).toISOString().slice(0, 10) : '',
      ]),
    ];
  };

  return (
    <ReportSection
      title="Low Stock"
      subtitle="Snapshot — current state, dates don’t apply."
      exportCsv={{ filename: 'low-stock', build: buildCsv }}
      disableExport={isLoading || rows.length === 0}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : rows.length === 0 ? (
        <NoData t={t} />
      ) : (
    <div>
      <Card label="Items Below Reorder Point" value={rows.length} className="mb-4 max-w-xs" />
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Part #</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Description</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Stock</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Reorder</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Deficit</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Supplier</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Last ordered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => {
              const deficit = Number(r.deficit ?? 0);
              const isCritical = (Number(r.stockQty ?? 0)) === 0;
              return (
                <tr key={i} className={isCritical ? 'bg-red-50' : ''}>
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">{String(r.partNumber ?? '-')}</td>
                  <td className="px-4 py-2 text-gray-900">{String(r.description ?? '-')}</td>
                  <td className={`px-4 py-2 text-end font-medium ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
                    {String(r.stockQty ?? 0)}
                  </td>
                  <td className="px-4 py-2 text-end text-gray-700">{String(r.reorderPoint ?? 0)}</td>
                  <td className="px-4 py-2 text-end font-medium text-red-600">{deficit}</td>
                  <td className="px-4 py-2 text-gray-700">{String(r.supplierName ?? '-')}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{r.lastOrderDate ? new Date(r.lastOrderDate as string).toLocaleDateString() : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
      )}
    </ReportSection>
  );
}

/* ────────── Purchase Request Summary ────────── */

function PurchaseRequestSummarySection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = usePurchaseRequestSummaryReport(startDate || undefined, endDate || undefined);
  const d = data as Record<string, unknown> | undefined;
  const summary = (d?.summary ?? {}) as Record<string, number>;
  const topByCost = (d?.topByCost ?? []) as Array<Record<string, unknown>>;

  const buildCsv = () => {
    if (!d) return null;
    const rows: unknown[][] = [
      ['Metric', 'Value'],
      ['Total PRs', summary.totalPrs ?? 0],
      ['Pending', summary.pendingCount ?? 0],
      ['Approved', summary.approvedCount ?? 0],
      ['Rejected', summary.rejectedCount ?? 0],
      ['Ordered', summary.orderedCount ?? 0],
      ['Received', summary.receivedCount ?? 0],
      ['Total est. cost', summary.totalEstimatedCost ?? 0],
      ['Avg approval (days)', summary.avgApprovalTime ?? 0],
      [],
      ['PR #', 'Status', 'Est. cost', 'Created'],
      ...topByCost.map((r) => [
        String(r.prNumber ?? ''),
        String(r.status ?? ''),
        Number(r.estimatedCost ?? 0),
        r.createdAt ? new Date(r.createdAt as string).toISOString().slice(0, 10) : '',
      ]),
    ];
    return rows;
  };

  return (
    <ReportSection
      title="Purchase Request Summary"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'purchase-requests', build: buildCsv }}
      disableExport={isLoading || !d}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 mb-4">
        <Card label="Total PRs" value={String(summary.totalPrs ?? 0)} />
        <Card label="Pending" value={String(summary.pendingCount ?? 0)} />
        <Card label="Approved" value={String(summary.approvedCount ?? 0)} />
        <Card label="Rejected" value={String(summary.rejectedCount ?? 0)} />
        <Card label="Ordered" value={String(summary.orderedCount ?? 0)} />
        <Card label="Received" value={String(summary.receivedCount ?? 0)} />
        <Card label="Total Est. Cost" value={money(summary.totalEstimatedCost ?? 0)} />
        <Card label="Avg Approval (days)" value={String(summary.avgApprovalTime ?? 0)} />
      </div>

      {topByCost.length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Top 10 by Estimated Cost</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">PR #</th>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">Est. Cost</th>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topByCost.map((r, i) => (
                  <tr key={i}>
                    <td className="px-6 py-3 font-medium">{String(r.prNumber ?? '-')}</td>
                    <td className="px-6 py-3">
                      <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {String(r.status ?? '-')}
                      </span>
                    </td>
                    <td className="px-6 py-3">{money(Number(r.estimatedCost ?? 0))}</td>
                    <td className="px-6 py-3">{r.createdAt ? new Date(r.createdAt as string).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
      )}
    </ReportSection>
  );
}

/* ────────── Vendor Performance ────────── */

function VendorPerformanceSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useVendorPerformanceReport(startDate || undefined, endDate || undefined);
  const rows = (data ?? []) as Array<Record<string, unknown>>;

  const buildCsv = () => {
    if (rows.length === 0) return null;
    return [
      ['Vendor', 'POs', 'Total spent', 'Avg delivery (days)', 'On-time %', 'Items ordered', 'Items received'],
      ...rows.map((r) => [
        String(r.vendorName ?? ''),
        Number(r.totalPOs ?? 0),
        Number(r.totalAmount ?? 0),
        r.avgDeliveryDays != null ? Number(r.avgDeliveryDays) : '',
        r.onTimePct != null ? Number(r.onTimePct) : '',
        Number(r.totalItemsOrdered ?? 0),
        Number(r.totalItemsReceived ?? 0),
      ]),
    ];
  };

  return (
    <ReportSection
      title="Vendor Performance"
      subtitle={dateRangeLabel(startDate, endDate)}
      exportCsv={{ filename: 'vendor-performance', build: buildCsv }}
      disableExport={isLoading || rows.length === 0}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : rows.length === 0 ? (
        <NoData t={t} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Vendor</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">POs</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Total spent</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Avg delivery (d)</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">On-time %</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Ordered</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 font-medium text-gray-900">{String(r.vendorName ?? '-')}</td>
                  <td className="px-4 py-2 text-end text-gray-700">{String(r.totalPOs ?? 0)}</td>
                  <td className="px-4 py-2 text-end text-gray-900">{money(Number(r.totalAmount ?? 0))}</td>
                  <td className="px-4 py-2 text-end text-gray-700">{r.avgDeliveryDays != null ? String(r.avgDeliveryDays) : '-'}</td>
                  <td className="px-4 py-2 text-end text-gray-700">{r.onTimePct != null ? `${r.onTimePct}%` : '-'}</td>
                  <td className="px-4 py-2 text-end text-gray-700">{String(r.totalItemsOrdered ?? 0)}</td>
                  <td className="px-4 py-2 text-end text-gray-700">{String(r.totalItemsReceived ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ReportSection>
  );
}

/* ────────── WIP Inventory ────────── */

function WipInventorySection({ money, t }: { money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useWipInventoryReport();
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  const d = data as Record<string, unknown> | undefined;
  const summary = (d?.summary ?? {}) as Record<string, unknown>;
  const aging = (summary.aging ?? {}) as Record<string, number>;
  const byJobStatus = (summary.byJobStatus ?? []) as Array<Record<string, unknown>>;
  const jobs = (d?.jobs ?? []) as Array<Record<string, unknown>>;

  const toggleJob = (jobId: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const buildCsv = () => {
    if (!d) return null;
    const rows: unknown[][] = [
      ['Job number', 'Customer', 'Vehicle', 'Status', 'Days open', 'Parts count', 'Cost value', 'Sell value'],
      ...jobs.map((j) => [
        String(j.jobNumber ?? ''),
        String(j.customerName ?? ''),
        String(j.vehiclePlate ?? ''),
        String(j.status ?? ''),
        Number(j.daysOpen ?? 0),
        Number(j.partsCount ?? 0),
        Number(j.costValue ?? 0),
        Number(j.sellValue ?? 0),
      ]),
    ];
    return rows;
  };

  return (
    <ReportSection
      title="WIP Inventory"
      subtitle="Parts on open job cards — snapshot."
      exportCsv={{ filename: 'wip-inventory', build: buildCsv }}
      disableExport={isLoading || !d}
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !d ? (
        <NoData t={t} />
      ) : (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card label={t('wipTotalParts')} value={String(summary.totalLines ?? 0)} />
        <Card label={t('wipTotalCostValue')} value={money(Number(summary.totalCostValue ?? 0))} />
        <Card label={t('wipTotalSellValue')} value={money(Number(summary.totalSellValue ?? 0))} />
        <Card label={t('wipAvgDaysOnJob')} value={String(summary.avgDaysOnJob ?? 0)} />
      </div>

      {/* Aging breakdown */}
      <h3 className="text-lg font-semibold text-gray-800 mb-3">{t('wipAgingBreakdown')}</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-700">0-7 {t('wipDays')}</p>
          <p className="mt-1 text-xl font-bold text-green-800">{aging.days0to7 ?? 0}</p>
        </div>
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-700">8-30 {t('wipDays')}</p>
          <p className="mt-1 text-xl font-bold text-yellow-800">{aging.days8to30 ?? 0}</p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-medium text-orange-700">31-60 {t('wipDays')}</p>
          <p className="mt-1 text-xl font-bold text-orange-800">{aging.days31to60 ?? 0}</p>
        </div>
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">60+ {t('wipDays')}</p>
          <p className="mt-1 text-xl font-bold text-red-800">{aging.days60plus ?? 0}</p>
        </div>
      </div>

      {/* By job status */}
      {byJobStatus.length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">{t('wipByJobStatus')}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 mb-6">
            {byJobStatus.map((s, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium text-gray-500">{String(s.status ?? '-')}</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{String(s.count ?? 0)} {t('wipParts')}</p>
                <p className="text-sm text-gray-500">{money(Number(s.costValue ?? 0))}</p>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Detail table grouped by job card */}
      {jobs.length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">{t('wipJobDetails')}</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start font-medium text-gray-500 w-8"></th>
                  <th className="px-4 py-3 text-start font-medium text-gray-500">{t('wipJobNumber')}</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-500">{t('wipCustomer')}</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-500">{t('wipVehicle')}</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-500">{t('wipDaysOpen')}</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-500">{t('wipPartsCount')}</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-500">{t('wipCostValue')}</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-500">{t('wipSellValue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => {
                  const jobId = job.jobId as string;
                  const daysOpen = Number(job.daysOpen ?? 0);
                  const isExpanded = expandedJobs.has(jobId);
                  const parts = (job.parts ?? []) as Array<Record<string, unknown>>;
                  const isStale = daysOpen > 60;

                  return (
                    <React.Fragment key={jobId}>
                      <tr
                        className={`cursor-pointer hover:bg-gray-50 ${isStale ? 'bg-red-50' : ''}`}
                        onClick={() => toggleJob(jobId)}
                      >
                        <td className="px-4 py-3 text-gray-400">{isExpanded ? '\u25BC' : '\u25B6'}</td>
                        <td className="px-4 py-3 font-medium">{String(job.jobNumber ?? '-')}</td>
                        <td className="px-4 py-3">{String(job.customerName ?? '-')}</td>
                        <td className="px-4 py-3">{String(job.vehiclePlate ?? '-')}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                            {String(job.status ?? '-')}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-medium ${isStale ? 'text-red-600' : daysOpen > 30 ? 'text-orange-600' : ''}`}>
                          {daysOpen}
                        </td>
                        <td className="px-4 py-3">{String(job.partsCount ?? 0)}</td>
                        <td className="px-4 py-3">{money(Number(job.costValue ?? 0))}</td>
                        <td className="px-4 py-3">{money(Number(job.sellValue ?? 0))}</td>
                      </tr>
                      {isExpanded && parts.length > 0 && (
                        <tr>
                          <td colSpan={9} className="bg-gray-50 px-8 py-3">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="text-gray-400">
                                  <th className="py-1 text-start font-medium">{t('wipPartName')}</th>
                                  <th className="py-1 text-start font-medium">{t('wipPartNumber')}</th>
                                  <th className="py-1 text-start font-medium">{t('wipQty')}</th>
                                  <th className="py-1 text-start font-medium">{t('wipUnitCost')}</th>
                                  <th className="py-1 text-start font-medium">{t('wipSellPrice')}</th>
                                  <th className="py-1 text-start font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {parts.map((p, pi) => (
                                  <tr key={pi} className="border-t border-gray-200">
                                    <td className="py-1.5 font-medium text-gray-700">{String(p.partName ?? '-')}</td>
                                    <td className="py-1.5 text-gray-500">{String(p.partNumber ?? '-')}</td>
                                    <td className="py-1.5">{String(p.quantity ?? 0)}</td>
                                    <td className="py-1.5">{money(Number(p.unitCost ?? 0))}</td>
                                    <td className="py-1.5">{money(Number(p.sellPrice ?? 0))}</td>
                                    <td className="py-1.5">
                                      <span
                                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                          p.stockStatus === 'reserved'
                                            ? 'bg-blue-100 text-blue-700'
                                            : p.stockStatus === 'issued'
                                              ? 'bg-green-100 text-green-700'
                                              : 'bg-gray-100 text-gray-700'
                                        }`}
                                      >
                                        {String(p.stockStatus ?? '-')}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
      )}
    </ReportSection>
  );
}

/* ────────── Statement of Account ────────── */

function CustomerStatementSection({
  money, moneyWhole, startDate, endDate, t,
}: {
  money: MoneyFn; moneyWhole: MoneyFn;
  startDate: string; endDate: string;
  t: TFn;
}) {
  const [customerId, setCustomerId] = useState<string>('');
  const { data: customersData } = useCustomers(1, '');
  const customers = (customersData?.data ?? []) as Array<{ id: string; full_name: string; phone?: string }>;
  const customerOptions = useMemo(
    () => [
      { value: '', label: 'All customers' },
      ...customers.map((c) => ({ value: c.id, label: `${c.full_name}${c.phone ? ' · ' + c.phone : ''}` })),
    ],
    [customers],
  );

  const isAll = !customerId;
  const { data: balances, isLoading: balLoading } = useCustomerBalances();
  const { data: statement, isLoading: stmtLoading } = useCustomerStatement(
    customerId || undefined,
    startDate || undefined,
    endDate || undefined,
  );

  const toast = useToast();
  const [sendingId, setSendingId] = useState<string | null>(null);
  const sendOne = async (id: string, name: string) => {
    setSendingId(id);
    try {
      const result = await api.post<{ sent_email: number; sent_whatsapp: number; failed: number; skipped: number }>(
        '/reports/statements/send',
        { customerIds: [id] },
      );
      if (result.sent_email + result.sent_whatsapp > 0) {
        toast.success(`Statement sent to ${name} (${result.sent_email ? 'email' : 'WhatsApp'})`);
      } else if (result.failed > 0) {
        toast.error(`Failed to send statement to ${name}`);
      } else {
        toast.error(`Skipped ${name} — no contact info or no provider configured`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSendingId(null);
    }
  };

  const allRows = balances ?? [];
  const allTotals = allRows.reduce(
    (acc, r) => {
      acc.current += r.current; acc.thirty += r.thirty; acc.sixty += r.sixty; acc.ninety += r.ninety;
      acc.total += r.total_outstanding; acc.customers++; acc.open_invoices += r.open_invoices;
      return acc;
    },
    { current: 0, thirty: 0, sixty: 0, ninety: 0, total: 0, customers: 0, open_invoices: 0 },
  );

  const buildAllCsv = () => {
    if (allRows.length === 0) return null;
    return [
      ['Customer', 'Phone', 'Email', 'Open invoices', 'Current', '<=30d', '<=60d', '90+d', 'Total outstanding'],
      ...allRows.map((r) => [
        r.full_name, r.phone ?? '', r.email ?? '',
        r.open_invoices, r.current, r.thirty, r.sixty, r.ninety, r.total_outstanding,
      ]),
      ['TOTAL', '', '', allTotals.open_invoices, allTotals.current, allTotals.thirty, allTotals.sixty, allTotals.ninety, allTotals.total],
    ];
  };

  const buildOneCsv = () => {
    if (!statement) return null;
    return [
      ['Date', 'Type', 'Reference', 'Description', 'Due date', 'Days overdue', 'Debit', 'Credit', 'Running balance'],
      ...statement.transactions.map((tx) => [
        tx.date, tx.type, tx.reference, tx.description,
        tx.due_date ?? '', tx.days_overdue ?? '',
        tx.debit, tx.credit, tx.runningBalance,
      ]),
    ];
  };

  const agingBadge = (b: string | null | undefined) => {
    if (!b) return '';
    if (b === '90+') return 'bg-red-100 text-red-700';
    if (b === '60') return 'bg-amber-100 text-amber-800';
    if (b === '30') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <ReportSection
      title="Statement of Account"
      subtitle={isAll
        ? 'All customers with open balances. Pick one for a detailed statement.'
        : `Per-customer statement. ${startDate || endDate ? dateRangeLabel(startDate, endDate) : 'All dates.'}`}
      exportCsv={isAll
        ? { filename: 'customer-balances', build: buildAllCsv }
        : { filename: `statement-${String(statement?.entity?.full_name ?? 'customer').replace(/\s+/g, '-').toLowerCase()}`, build: buildOneCsv }}
      disableExport={isAll ? balLoading || allRows.length === 0 : stmtLoading || !statement}
      rightSlot={
        <div className="w-64">
          <SearchableSelect
            value={customerId}
            options={customerOptions}
            placeholder="All customers"
            allowFreeText={false}
            onChange={setCustomerId}
          />
        </div>
      }
    >
      {isAll ? (
        balLoading ? (
          <p className="text-sm text-gray-500">...</p>
        ) : allRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-green-700">No customers with open balances. &#127881;</p>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Card label="Customers" value={String(allTotals.customers)} />
              <Card label="Current" value={moneyWhole(allTotals.current)} />
              <Card label="<= 30 days" value={moneyWhole(allTotals.thirty)} />
              <Card label="<= 60 days" value={moneyWhole(allTotals.sixty)} />
              <Card label="90+ days" value={moneyWhole(allTotals.ninety)} />
            </div>
            <div className="overflow-hidden rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-start">Customer</th>
                    <th className="px-3 py-2 text-end">Open inv.</th>
                    <th className="px-3 py-2 text-end">Current</th>
                    <th className="px-3 py-2 text-end">&lt;=30d</th>
                    <th className="px-3 py-2 text-end">&lt;=60d</th>
                    <th className="px-3 py-2 text-end">90+d</th>
                    <th className="px-3 py-2 text-end">Total</th>
                    <th className="px-3 py-2 text-end"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allRows.map((r) => (
                    <tr key={r.customer_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setCustomerId(r.customer_id)}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          {r.full_name}
                        </button>
                        {r.phone && <div className="text-xs text-gray-500">{r.phone}</div>}
                      </td>
                      <td className="px-3 py-2 text-end text-gray-700">{r.open_invoices}</td>
                      <td className="px-3 py-2 text-end text-gray-700">{money(r.current)}</td>
                      <td className="px-3 py-2 text-end text-yellow-700">{money(r.thirty)}</td>
                      <td className="px-3 py-2 text-end text-amber-700">{money(r.sixty)}</td>
                      <td className="px-3 py-2 text-end font-medium text-red-600">{money(r.ninety)}</td>
                      <td className="px-3 py-2 text-end font-bold text-gray-900">{money(r.total_outstanding)}</td>
                      <td className="px-3 py-2 text-end">
                        <button
                          type="button"
                          onClick={() => sendOne(r.customer_id, r.full_name)}
                          disabled={sendingId === r.customer_id || (!r.email && !r.phone)}
                          title={!r.email && !r.phone ? 'No email or phone on file' : 'Email statement now'}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          {sendingId === r.customer_id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Send
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td className="px-3 py-2 text-gray-700">TOTAL</td>
                    <td className="px-3 py-2 text-end text-gray-700">{allTotals.open_invoices}</td>
                    <td className="px-3 py-2 text-end text-gray-900">{money(allTotals.current)}</td>
                    <td className="px-3 py-2 text-end text-yellow-700">{money(allTotals.thirty)}</td>
                    <td className="px-3 py-2 text-end text-amber-700">{money(allTotals.sixty)}</td>
                    <td className="px-3 py-2 text-end text-red-600">{money(allTotals.ninety)}</td>
                    <td className="px-3 py-2 text-end text-gray-900">{money(allTotals.total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )
      ) : stmtLoading ? (
        <p className="text-sm text-gray-500">...</p>
      ) : !statement ? (
        <NoData t={t} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900">{String(statement.entity.full_name ?? '-')}</div>
              <div className="text-xs text-gray-500">
                {statement.entity.phone ? `${statement.entity.phone} - ` : ''}
                {statement.entity.email ?? ''}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => sendOne(customerId, String(statement.entity.full_name ?? 'customer'))}
                disabled={sendingId === customerId || (!statement.entity.email && !statement.entity.phone)}
                title={!statement.entity.email && !statement.entity.phone ? 'No email or phone on file' : 'Email statement now'}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                {sendingId === customerId ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send statement
              </button>
              <div className="text-end">
                <div className="text-xs text-gray-500">Closing balance</div>
                <div className="text-2xl font-bold text-gray-900">{moneyWhole(statement.closingBalance)}</div>
              </div>
            </div>
          </div>

          {statement.aging && statement.aging.total > 0 && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card label="Current" value={moneyWhole(statement.aging.current)} />
              <Card label="<= 30 days" value={moneyWhole(statement.aging.thirty)} />
              <Card label="<= 60 days" value={moneyWhole(statement.aging.sixty)} />
              <Card label="90+ days" value={moneyWhole(statement.aging.ninety)} />
            </div>
          )}

          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-start">Date</th>
                  <th className="px-3 py-2 text-start">Type</th>
                  <th className="px-3 py-2 text-start">Reference</th>
                  <th className="px-3 py-2 text-start">Due</th>
                  <th className="px-3 py-2 text-end">Days overdue</th>
                  <th className="px-3 py-2 text-end">Debit</th>
                  <th className="px-3 py-2 text-end">Credit</th>
                  <th className="px-3 py-2 text-end">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr className="bg-gray-50/50">
                  <td colSpan={7} className="px-3 py-1.5 text-xs italic text-gray-500">Opening balance</td>
                  <td className="px-3 py-1.5 text-end text-xs text-gray-700">{money(statement.openingBalance)}</td>
                </tr>
                {statement.transactions.map((tx, i) => (
                  <tr key={i} className={tx.aging_bucket === '90+' ? 'bg-red-50/40' : tx.aging_bucket === '60' ? 'bg-amber-50/30' : ''}>
                    <td className="px-3 py-2 text-xs text-gray-500">{formatDate(tx.date)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        tx.type === 'invoice' ? 'bg-blue-100 text-blue-700' :
                        tx.type === 'payment' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{tx.type}</span>
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">{tx.reference}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{tx.due_date ? formatDate(tx.due_date) : '-'}</td>
                    <td className="px-3 py-2 text-end">
                      {tx.aging_bucket ? (
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${agingBadge(tx.aging_bucket)}`}>
                          {tx.days_overdue ?? 0}d
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-end text-gray-700">{tx.debit > 0 ? money(tx.debit) : ''}</td>
                    <td className="px-3 py-2 text-end text-green-700">{tx.credit > 0 ? money(tx.credit) : ''}</td>
                    <td className="px-3 py-2 text-end font-medium text-gray-900">{money(tx.runningBalance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-end text-gray-700">Totals</td>
                  <td className="px-3 py-2 text-end text-gray-900">{money(statement.totalDebits)}</td>
                  <td className="px-3 py-2 text-end text-green-700">{money(statement.totalCredits)}</td>
                  <td className="px-3 py-2 text-end text-gray-900">{money(statement.closingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </ReportSection>
  );
}

function AgingReceivablesSection({
  money,
  moneyWhole,
  t,
}: {
  money: MoneyFn;
  moneyWhole: MoneyFn;
  t: TFn;
}) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState<string>('');
  const [asOfDate, setAsOfDate] = useState<string>(todayStr);
  const [bucketFilter, setBucketFilter] =
    useState<'all' | 'current' | '30' | '60' | '90' | '90+'>('all');

  const { data: customersData } = useCustomers(1, '');
  const customers = (customersData?.data ?? []) as Array<{ id: string; full_name: string; phone?: string }>;
  const customerOptions = useMemo(
    () => [
      { value: '', label: 'All customers' },
      ...customers.map((c) => ({
        value: c.id,
        label: `${c.full_name}${c.phone ? ' · ' + c.phone : ''}`,
      })),
    ],
    [customers],
  );

  const { data: report, isLoading } = useAgingReceivables(customerId || undefined, asOfDate);

  // Apply optional bucket filter on the client side without re-querying.
  const filteredGroups: AgingCustomerGroup[] = useMemo(() => {
    if (!report) return [];
    if (bucketFilter === 'all') return report.customers;
    return report.customers
      .map((g): AgingCustomerGroup => {
        const invoices = g.invoices.filter((i) => i.bucket === bucketFilter);
        if (invoices.length === 0) return { ...g, invoices: [], totals: { ...g.totals, invoice_count: 0, total: 0, current: 0, thirty: 0, sixty: 0, ninety: 0, ninetyPlus: 0 } };
        const totals = invoices.reduce(
          (t, r) => {
            t.total += r.balance_due;
            t.invoice_count++;
            if (r.bucket === 'current') t.current += r.balance_due;
            else if (r.bucket === '30') t.thirty += r.balance_due;
            else if (r.bucket === '60') t.sixty += r.balance_due;
            else if (r.bucket === '90') t.ninety += r.balance_due;
            else t.ninetyPlus += r.balance_due;
            return t;
          },
          { current: 0, thirty: 0, sixty: 0, ninety: 0, ninetyPlus: 0, total: 0, invoice_count: 0 },
        );
        return { ...g, invoices, totals };
      })
      .filter((g) => g.invoices.length > 0);
  }, [report, bucketFilter]);

  const filteredTotals = useMemo(() => {
    const t = { current: 0, thirty: 0, sixty: 0, ninety: 0, ninetyPlus: 0, total: 0, invoice_count: 0 };
    for (const g of filteredGroups) {
      t.current += g.totals.current;
      t.thirty += g.totals.thirty;
      t.sixty += g.totals.sixty;
      t.ninety += g.totals.ninety;
      t.ninetyPlus += g.totals.ninetyPlus;
      t.total += g.totals.total;
      t.invoice_count += g.totals.invoice_count;
    }
    return t;
  }, [filteredGroups]);

  const buildXlsx = () => {
    if (filteredGroups.length === 0) return null;
    const rows: (string | number)[][] = [
      ['Customer', 'Phone', 'Invoice #', 'Invoice date', 'Due date', 'Days overdue', 'Bucket', 'Original', 'Paid', 'Balance due'],
    ];
    for (const g of filteredGroups) {
      for (const inv of g.invoices) {
        rows.push([
          g.customer_name,
          g.customer_phone ?? '',
          inv.invoice_number,
          inv.invoice_date ?? '',
          inv.due_date ?? '',
          inv.days_overdue,
          inv.bucket,
          inv.grand_total,
          inv.paid_amount,
          inv.balance_due,
        ]);
      }
      rows.push([
        `Subtotal — ${g.customer_name}`,
        '',
        `${g.totals.invoice_count} invoices`,
        '',
        '',
        '',
        '',
        '',
        '',
        g.totals.total,
      ]);
    }
    rows.push([
      'GRAND TOTAL',
      '',
      `${filteredTotals.invoice_count} invoices`,
      '',
      '',
      '',
      '',
      '',
      '',
      filteredTotals.total,
    ]);
    return rows;
  };

  const bucketStyle = (b: AgingReceivableRow['bucket']): string => {
    if (b === '90+') return 'bg-red-100 text-red-700';
    if (b === '90') return 'bg-red-50 text-red-600';
    if (b === '60') return 'bg-amber-100 text-amber-700';
    if (b === '30') return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <ReportSection
      title="Aging of Receivables"
      subtitle={`Snapshot as of ${asOfDate}. ${
        customerId ? 'Single customer view.' : 'Grouped by customer, oldest invoice first.'
      }`}
      exportCsv={{
        filename: `aging-receivables-${asOfDate}${customerId ? '-customer' : ''}`,
        build: buildXlsx,
      }}
      disableExport={isLoading || filteredGroups.length === 0}
      rightSlot={
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-64">
            <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Customer
            </label>
            <SearchableSelect
              value={customerId}
              options={customerOptions}
              placeholder="All customers"
              allowFreeText={false}
              onChange={setCustomerId}
            />
          </div>
          <div>
            <label className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
              As of
            </label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value || todayStr)}
              max={todayStr}
              className="h-9 rounded-md border border-gray-300 px-2 text-sm"
            />
          </div>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !report || report.customers.length === 0 ? (
        <p className="py-6 text-center text-sm text-green-700">
          No open invoices on {asOfDate}. 🎉
        </p>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
            <Card label="Open invoices" value={String(filteredTotals.invoice_count)} />
            <Card label="Current" value={moneyWhole(filteredTotals.current)} />
            <Card label="1–30 days" value={moneyWhole(filteredTotals.thirty)} />
            <Card label="31–60 days" value={moneyWhole(filteredTotals.sixty)} />
            <Card label="61–90 days" value={moneyWhole(filteredTotals.ninety)} />
            <Card
              label="90+ days"
              value={moneyWhole(filteredTotals.ninetyPlus)}
              className={filteredTotals.ninetyPlus > 0 ? 'border-red-200 bg-red-50' : ''}
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Bucket
            </span>
            {(['all', 'current', '30', '60', '90', '90+'] as const).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBucketFilter(b)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  bucketFilter === b
                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {b === 'all'
                  ? 'All'
                  : b === 'current'
                    ? 'Current'
                    : b === '30'
                      ? '1–30 d'
                      : b === '60'
                        ? '31–60 d'
                        : b === '90'
                          ? '61–90 d'
                          : '90+ d'}
              </button>
            ))}
          </div>

          {filteredGroups.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-500">
              No invoices in the selected bucket.
            </p>
          ) : (
            <div className="overflow-hidden rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-start">Invoice</th>
                    <th className="px-3 py-2 text-start">Invoice date</th>
                    <th className="px-3 py-2 text-start">Due date</th>
                    <th className="px-3 py-2 text-end">Days overdue</th>
                    <th className="px-3 py-2 text-start">Bucket</th>
                    <th className="px-3 py-2 text-end">Original</th>
                    <th className="px-3 py-2 text-end">Paid</th>
                    <th className="px-3 py-2 text-end">Balance due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredGroups.map((g) => (
                    <React.Fragment key={g.customer_id ?? g.customer_name}>
                      <tr className="bg-gray-50">
                        <td
                          colSpan={8}
                          className="px-3 py-2 text-sm font-semibold text-gray-800"
                        >
                          <button
                            type="button"
                            onClick={() => setCustomerId(g.customer_id ?? '')}
                            className="text-primary-700 hover:underline"
                          >
                            {g.customer_name}
                          </button>
                          {g.customer_phone && (
                            <span className="ms-2 text-xs font-normal text-gray-500">
                              {g.customer_phone}
                            </span>
                          )}
                          <span className="float-end text-xs font-normal text-gray-500">
                            {g.totals.invoice_count} open · {money(g.totals.total)}
                          </span>
                        </td>
                      </tr>
                      {g.invoices.map((inv) => (
                        <tr
                          key={inv.invoice_id}
                          className={
                            inv.bucket === '90+'
                              ? 'bg-red-50/40'
                              : inv.bucket === '90'
                                ? 'bg-red-50/20'
                                : inv.bucket === '60'
                                  ? 'bg-amber-50/30'
                                  : ''
                          }
                        >
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {inv.invoice_number}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {inv.invoice_date ? formatDate(inv.invoice_date) : '—'}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-500">
                            {inv.due_date ? formatDate(inv.due_date) : '—'}
                          </td>
                          <td className="px-3 py-2 text-end tabular-nums">
                            <span
                              className={
                                inv.days_overdue > 60
                                  ? 'font-semibold text-red-600'
                                  : inv.days_overdue > 30
                                    ? 'font-medium text-amber-700'
                                    : inv.days_overdue > 0
                                      ? 'text-yellow-700'
                                      : 'text-gray-500'
                              }
                            >
                              {inv.days_overdue}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${bucketStyle(
                                inv.bucket,
                              )}`}
                            >
                              {inv.bucket === 'current' ? 'Current' : `${inv.bucket}d`}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-end text-gray-700">
                            {money(inv.grand_total)}
                          </td>
                          <td className="px-3 py-2 text-end text-emerald-700">
                            {money(inv.paid_amount)}
                          </td>
                          <td className="px-3 py-2 text-end font-semibold text-gray-900">
                            {money(inv.balance_due)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-gray-50/60 text-xs">
                        <td colSpan={4}></td>
                        <td className="px-3 py-1.5 text-gray-500">Subtotal</td>
                        <td className="px-3 py-1.5 text-end text-gray-700">
                          {money(
                            g.invoices.reduce((s, i) => s + i.grand_total, 0),
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-end text-gray-700">
                          {money(
                            g.invoices.reduce((s, i) => s + i.paid_amount, 0),
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-end font-semibold text-gray-900">
                          {money(g.totals.total)}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot className="bg-gray-100 font-semibold">
                  <tr>
                    <td className="px-3 py-2 text-gray-700" colSpan={3}>
                      GRAND TOTAL
                    </td>
                    <td className="px-3 py-2 text-end text-gray-700">
                      {filteredTotals.invoice_count}
                    </td>
                    <td></td>
                    <td className="px-3 py-2 text-end text-gray-900">
                      {money(
                        filteredGroups.reduce(
                          (s, g) => s + g.invoices.reduce((ss, i) => ss + i.grand_total, 0),
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-3 py-2 text-end text-gray-900">
                      {money(
                        filteredGroups.reduce(
                          (s, g) => s + g.invoices.reduce((ss, i) => ss + i.paid_amount, 0),
                          0,
                        ),
                      )}
                    </td>
                    <td className="px-3 py-2 text-end text-gray-900">
                      {money(filteredTotals.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </ReportSection>
  );
}
