'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useFormat } from '@/hooks/use-format';
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
  const { money } = useFormat();

  const [selectedReport, setSelectedReport] = useState<ReportType>('revenue');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const reportOptions: { value: ReportType; label: string }[] = [
    { value: 'revenue', label: t('revenue') },
    { value: 'jobCards', label: t('jobCards') },
    { value: 'technicians', label: t('technicians') },
    { value: 'partsUsage', label: t('partsUsage') },
    { value: 'outstandingInvoices', label: t('outstandingInvoices') },
    { value: 'outstandingBills', label: t('outstandingBills') },
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
      <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>

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
          <OutstandingInvoicesSection money={money} t={t} />
        )}
        {selectedReport === 'outstandingBills' && (
          <OutstandingBillsSection money={money} t={t} />
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

/* ────────── Revenue ────────── */

function RevenueSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useRevenueReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, number> | undefined;
  if (!d) return <NoData t={t} />;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Card label={t('totalInvoiced')} value={money(d.total_invoiced ?? 0)} />
      <Card label="Labour" value={money(d.labour_total ?? 0)} />
      <Card label="Parts" value={money(d.parts_total ?? 0)} />
      <Card label="Tax" value={money(d.tax_total ?? 0)} />
      <Card label={t('paymentsReceived')} value={money(d.payments_received ?? 0)} />
    </div>
  );
}

/* ────────── Job Cards ────────── */

function JobCardsSection({ startDate, endDate, t }: { startDate: string; endDate: string; t: TFn }) {
  const { data, isLoading } = useJobCardReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return <NoData t={t} />;

  const statusBreakdown = (d.by_status ?? d.status_breakdown ?? {}) as Record<string, number>;

  return (
    <div>
      <Card label="Total" value={String(d.total ?? 0)} className="mb-6 max-w-xs" />
      {Object.keys(statusBreakdown).length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(statusBreakdown).map(([status, count]) => (
                <tr key={status}>
                  <td className="px-6 py-3">
                    <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      {status}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-medium">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ────────── Technicians ────────── */

function TechniciansSection({ startDate, endDate, t }: { startDate: string; endDate: string; t: TFn }) {
  const { data, isLoading } = useTechnicianReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return <NoData t={t} />;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Name</th>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Hours</th>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Jobs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-6 py-3 font-medium">{String(r.full_name ?? r.name ?? '-')}</td>
              <td className="px-6 py-3">{String(r.total_hours ?? r.hours ?? 0)}</td>
              <td className="px-6 py-3">{String(r.total_jobs ?? r.jobs ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ────────── Parts Usage ────────── */

function PartsUsageSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = usePartsUsageReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return <NoData t={t} />;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Part</th>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Qty</th>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-6 py-3 font-medium">{String(r.description ?? r.part_number ?? '-')}</td>
              <td className="px-6 py-3">{String(r.total_qty ?? r.quantity ?? 0)}</td>
              <td className="px-6 py-3">{money(Number(r.total_value ?? r.value ?? 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ────────── Outstanding Invoices ────────── */

function OutstandingInvoicesSection({ money, t }: { money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useOutstandingInvoices();
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return <NoData t={t} />;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      <Card label="Total" value={money(Number(d.total ?? 0))} />
      <Card label="Current" value={money(Number(d.current ?? 0))} />
      <Card label="30 days" value={money(Number(d.days_30 ?? d['30'] ?? 0))} />
      <Card label="60 days" value={money(Number(d.days_60 ?? d['60'] ?? 0))} />
      <Card label="90+ days" value={money(Number(d.days_90_plus ?? d['90+'] ?? d['90'] ?? 0))} />
    </div>
  );
}

/* ────────── Outstanding Bills ────────── */

function OutstandingBillsSection({ money, t }: { money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useOutstandingBills();
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return <NoData t={t} />;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      <Card label="Total" value={money(Number(d.total ?? 0))} />
      <Card label="Current" value={money(Number(d.current ?? 0))} />
      <Card label="30 days" value={money(Number(d.days_30 ?? d['30'] ?? 0))} />
      <Card label="60 days" value={money(Number(d.days_60 ?? d['60'] ?? 0))} />
      <Card label="90+ days" value={money(Number(d.days_90_plus ?? d['90+'] ?? d['90'] ?? 0))} />
    </div>
  );
}

/* ────────── Expenses by Category ────────── */

function ExpensesSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useExpenseReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return <NoData t={t} />;

  const total = rows.reduce((sum, r) => sum + Number(r.total ?? r.amount ?? 0), 0);

  return (
    <div>
      <Card label="Total" value={money(total)} className="mb-6 max-w-xs" />
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-start font-medium text-gray-500">Category</th>
              <th className="px-6 py-3 text-start font-medium text-gray-500">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-6 py-3 font-medium">{String(r.category ?? '-')}</td>
                <td className="px-6 py-3">{money(Number(r.total ?? r.amount ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────── Income vs Expense ────────── */

function IncomeExpenseSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useIncomeExpenseReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, number> | undefined;
  if (!d) return <NoData t={t} />;

  const netProfit = (d.income ?? 0) - (d.expenses ?? 0) - (d.bills ?? 0);
  const isPositive = netProfit >= 0;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
  );
}

/* ────────── Insurance ────────── */

function InsuranceSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useInsuranceReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return <NoData t={t} />;

  const byStatus = (d.by_status ?? {}) as Record<string, number>;

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Total claims" value={String(d.total_claims ?? 0)} />
        <Card label="Avg approval time" value={`${String(d.avg_approval_time ?? d.avg_approval_hours ?? '-')}h`} />
        <Card label="Total approved" value={money(Number(d.total_approved ?? 0))} />
      </div>
      {Object.keys(byStatus).length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Status</th>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(byStatus).map(([status, count]) => (
                <tr key={status}>
                  <td className="px-6 py-3 font-medium">{status}</td>
                  <td className="px-6 py-3">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ────────── Customer Retention ────────── */

function CustomerRetentionSection({ startDate, endDate, t }: { startDate: string; endDate: string; t: TFn }) {
  const { data, isLoading } = useCustomerRetentionReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return <NoData t={t} />;

  const topCustomers = (d.top_customers ?? []) as Array<Record<string, unknown>>;

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <Card label="Repeat customers" value={String(d.repeat ?? 0)} />
        <Card label="New customers" value={String(d.new ?? 0)} />
        <Card label="Total" value={String(d.total ?? 0)} />
      </div>
      {topCustomers.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Customer</th>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Visits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topCustomers.slice(0, 10).map((c, i) => (
                <tr key={i}>
                  <td className="px-6 py-3 font-medium">{String(c.full_name ?? c.name ?? '-')}</td>
                  <td className="px-6 py-3">{String(c.visits ?? c.count ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ────────── Credit Notes ────────── */

function CreditNotesSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useIncomeExpenseReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return <NoData t={t} />;

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-lg">
      <Card label="Count" value={String(d.credit_notes_count ?? 0)} />
      <Card label="Total" value={money(Number(d.credit_notes_total ?? 0))} />
    </div>
  );
}

/* ────────── Inventory Valuation ────────── */

function InventoryValuationSection({ money, t }: { money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useInventoryValuationReport();
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return <NoData t={t} />;

  const summary = (d.summary ?? {}) as Record<string, number>;
  const byCategory = (d.byCategory ?? {}) as Record<string, Record<string, number>>;
  const byWarehouse = (d.byWarehouse ?? {}) as Record<string, Record<string, unknown>>;

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-6">
        <Card label="Total SKUs" value={String(summary.totalSkus ?? 0)} />
        <Card label="Total Units" value={String(summary.totalUnits ?? 0)} />
        <Card label="Total Value" value={money(summary.totalValue ?? 0)} />
      </div>

      {Object.keys(byCategory).length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">By Category</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm mb-6">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">Category</th>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">SKUs</th>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">Units</th>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(byCategory).map(([cat, data]) => (
                  <tr key={cat}>
                    <td className="px-6 py-3 font-medium">{cat}</td>
                    <td className="px-6 py-3">{data.skus ?? 0}</td>
                    <td className="px-6 py-3">{data.units ?? 0}</td>
                    <td className="px-6 py-3">{money(data.value ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {Object.keys(byWarehouse).length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">By Warehouse</h3>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">Warehouse</th>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">Units</th>
                  <th className="px-6 py-3 text-start font-medium text-gray-500">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {Object.entries(byWarehouse).map(([whId, data]) => (
                  <tr key={whId}>
                    <td className="px-6 py-3 font-medium">{String(data.warehouseName ?? '-')}</td>
                    <td className="px-6 py-3">{String(data.units ?? 0)}</td>
                    <td className="px-6 py-3">{money(Number(data.value ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ────────── Stock Movements ────────── */

function StockMovementsSection({ startDate, endDate, t }: { startDate: string; endDate: string; t: TFn }) {
  const { data, isLoading } = useStockMovementsReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return <NoData t={t} />;

  const summary = (d.summary ?? {}) as Record<string, number>;
  const movements = (d.movements ?? []) as Array<Record<string, unknown>>;

  return (
    <div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-6">
        <Card label="Total In" value={String(summary.totalIn ?? 0)} className="border-green-200 bg-green-50" />
        <Card label="Total Out" value={String(summary.totalOut ?? 0)} className="border-red-200 bg-red-50" />
        <Card label="Net Change" value={String(summary.netChange ?? 0)} />
      </div>

      {movements.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Part</th>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Qty Change</th>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Reason</th>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Reference</th>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Adjusted By</th>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Warehouse</th>
                <th className="px-6 py-3 text-start font-medium text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {movements.map((m, i) => {
                const qty = Number(m.quantityChange ?? 0);
                return (
                  <tr key={i}>
                    <td className="px-6 py-3 font-medium">{String(m.partDescription ?? '-')}</td>
                    <td className={`px-6 py-3 font-medium ${qty > 0 ? 'text-green-600' : qty < 0 ? 'text-red-600' : ''}`}>
                      {qty > 0 ? `+${qty}` : String(qty)}
                    </td>
                    <td className="px-6 py-3">{String(m.reason ?? '-')}</td>
                    <td className="px-6 py-3">{String(m.reference ?? '-')}</td>
                    <td className="px-6 py-3">{String(m.adjustedBy ?? '-')}</td>
                    <td className="px-6 py-3">{String(m.warehouse ?? '-')}</td>
                    <td className="px-6 py-3">{m.createdAt ? new Date(m.createdAt as string).toLocaleDateString() : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ────────── Low Stock ────────── */

function LowStockSection({ t }: { t: TFn }) {
  const { data, isLoading } = useLowStockReport();
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return <NoData t={t} />;

  return (
    <div>
      <Card label="Items Below Reorder Point" value={rows.length} className="mb-6 max-w-xs" />
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-start font-medium text-gray-500">Part #</th>
              <th className="px-6 py-3 text-start font-medium text-gray-500">Description</th>
              <th className="px-6 py-3 text-start font-medium text-gray-500">Stock</th>
              <th className="px-6 py-3 text-start font-medium text-gray-500">Reorder Point</th>
              <th className="px-6 py-3 text-start font-medium text-gray-500">Deficit</th>
              <th className="px-6 py-3 text-start font-medium text-gray-500">Supplier</th>
              <th className="px-6 py-3 text-start font-medium text-gray-500">Last Ordered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => {
              const deficit = Number(r.deficit ?? 0);
              const isCritical = (Number(r.stockQty ?? 0)) === 0;
              return (
                <tr key={i} className={isCritical ? 'bg-red-50' : ''}>
                  <td className="px-6 py-3 font-medium">{String(r.partNumber ?? '-')}</td>
                  <td className="px-6 py-3">{String(r.description ?? '-')}</td>
                  <td className={`px-6 py-3 font-medium ${isCritical ? 'text-red-600' : 'text-amber-600'}`}>
                    {String(r.stockQty ?? 0)}
                  </td>
                  <td className="px-6 py-3">{String(r.reorderPoint ?? 0)}</td>
                  <td className="px-6 py-3 font-medium text-red-600">{deficit}</td>
                  <td className="px-6 py-3">{String(r.supplierName ?? '-')}</td>
                  <td className="px-6 py-3">{r.lastOrderDate ? new Date(r.lastOrderDate as string).toLocaleDateString() : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ────────── Purchase Request Summary ────────── */

function PurchaseRequestSummarySection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = usePurchaseRequestSummaryReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return <NoData t={t} />;

  const summary = (d.summary ?? {}) as Record<string, number>;
  const topByCost = (d.topByCost ?? []) as Array<Record<string, unknown>>;

  return (
    <div>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 mb-6">
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
  );
}

/* ────────── Vendor Performance ────────── */

function VendorPerformanceSection({ startDate, endDate, money, t }: { startDate: string; endDate: string; money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useVendorPerformanceReport(startDate || undefined, endDate || undefined);
  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) return <NoData t={t} />;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Vendor</th>
            <th className="px-6 py-3 text-start font-medium text-gray-500">POs</th>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Total Spent</th>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Avg Delivery (days)</th>
            <th className="px-6 py-3 text-start font-medium text-gray-500">On-Time %</th>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Items Ordered</th>
            <th className="px-6 py-3 text-start font-medium text-gray-500">Items Received</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-6 py-3 font-medium">{String(r.vendorName ?? '-')}</td>
              <td className="px-6 py-3">{String(r.totalPOs ?? 0)}</td>
              <td className="px-6 py-3">{money(Number(r.totalAmount ?? 0))}</td>
              <td className="px-6 py-3">{r.avgDeliveryDays != null ? String(r.avgDeliveryDays) : '-'}</td>
              <td className="px-6 py-3">{r.onTimePct != null ? `${r.onTimePct}%` : '-'}</td>
              <td className="px-6 py-3">{String(r.totalItemsOrdered ?? 0)}</td>
              <td className="px-6 py-3">{String(r.totalItemsReceived ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ────────── WIP Inventory ────────── */

function WipInventorySection({ money, t }: { money: MoneyFn; t: TFn }) {
  const { data, isLoading } = useWipInventoryReport();
  const [expandedJobs, setExpandedJobs] = useState<Set<string>>(new Set());

  if (isLoading) return <p className="text-sm text-gray-500">...</p>;
  const d = data as Record<string, unknown> | undefined;
  if (!d) return <NoData t={t} />;

  const summary = (d.summary ?? {}) as Record<string, unknown>;
  const aging = (summary.aging ?? {}) as Record<string, number>;
  const byJobStatus = (summary.byJobStatus ?? []) as Array<Record<string, unknown>>;
  const jobs = (d.jobs ?? []) as Array<Record<string, unknown>>;

  const toggleJob = (jobId: string) => {
    setExpandedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  return (
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
  );
}
