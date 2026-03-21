'use client';

import { useState } from 'react';
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
  | 'creditNotes';

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
