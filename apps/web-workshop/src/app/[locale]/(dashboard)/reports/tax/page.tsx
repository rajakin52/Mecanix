'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

interface ByRateRow { rate: number; vat: number; invoices: number }
interface VatSummary {
  period: { startDate: string; endDate: string };
  totals: { subtotal: number; total_vat: number; grand_total: number; invoice_count: number };
  by_rate: ByRateRow[];
}

interface CaptiveInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_tax_id: string | null;
  grand_total: number;
  captive_pct: number;
  captive_amount: number;
}
interface CaptiveReport {
  period: { startDate: string; endDate: string };
  total_captive: number;
  invoice_count: number;
  invoices: CaptiveInvoice[];
}

interface RetentionInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_name: string;
  customer_tax_id: string | null;
  labour_total: number;
  retention_pct: number;
  retention_amount: number;
}
interface RetentionReport {
  period: { startDate: string; endDate: string };
  total_retention: number;
  invoice_count: number;
  invoices: RetentionInvoice[];
}

function defaultStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TaxReportsPage() {
  const [startDate, setStartDate] = useState(defaultStart());
  const [endDate, setEndDate] = useState(today());
  const [tab, setTab] = useState<'summary' | 'captive' | 'retention'>('summary');

  const params = `startDate=${startDate}&endDate=${endDate}`;

  const { data: summary } = useQuery({
    queryKey: ['vat-summary', startDate, endDate],
    queryFn: () => api.get<VatSummary>(`/reports/vat-summary?${params}`),
    enabled: tab === 'summary',
  });

  const { data: captive } = useQuery({
    queryKey: ['captive-vat', startDate, endDate],
    queryFn: () => api.get<CaptiveReport>(`/reports/captive-vat?${params}`),
    enabled: tab === 'captive',
  });

  const { data: retention } = useQuery({
    queryKey: ['service-retention', startDate, endDate],
    queryFn: () => api.get<RetentionReport>(`/reports/service-retention?${params}`),
    enabled: tab === 'retention',
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href="/reports" className="text-sm text-gray-500 hover:text-gray-700">&larr; Reports</Link>
        <h1 className="text-2xl font-bold text-gray-900">Tax Reports</h1>
      </div>

      {/* Date range */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-gray-600">From</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600">To</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {([
          { key: 'summary',   label: 'IVA Summary' },
          { key: 'captive',   label: 'IVA Cativo (receivable)' },
          { key: 'retention', label: 'Retenção Serviços (credit)' },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <StatCard label="Invoices" value={String(summary.totals.invoice_count)} />
            <StatCard label="Subtotal" value={formatCurrency(summary.totals.subtotal)} />
            <StatCard label="Total IVA" value={formatCurrency(summary.totals.total_vat)} />
            <StatCard label="Grand Total" value={formatCurrency(summary.totals.grand_total)} />
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Rate</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">VAT collected</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.by_rate.length === 0 ? (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">No VAT collected in this period.</td></tr>
                ) : summary.by_rate.map((r) => (
                  <tr key={r.rate}>
                    <td className="px-4 py-3">IVA {r.rate.toFixed(0)}%</td>
                    <td className="px-4 py-3 text-end font-medium">{formatCurrency(r.vat)}</td>
                    <td className="px-4 py-3 text-end text-gray-600">{r.invoices}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'captive' && captive && (
        <CaptiveTable report={captive} />
      )}

      {tab === 'retention' && retention && (
        <RetentionTable report={retention} />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function CaptiveTable({ report }: { report: CaptiveReport }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Invoices with IVA Cativo" value={String(report.invoice_count)} />
        <StatCard label="Total receivable from state" value={formatCurrency(report.total_captive)} />
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Invoice</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Customer</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">NIF</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Captive %</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Captive amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No captive VAT in this period.</td></tr>
            ) : report.invoices.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-gray-600">{r.invoice_date?.slice(0, 10)}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/invoices/${r.id}`} className="text-primary-600 hover:underline">{r.invoice_number}</Link>
                </td>
                <td className="px-4 py-3">{r.customer_name}</td>
                <td className="px-4 py-3 text-gray-500">{r.customer_tax_id ?? '-'}</td>
                <td className="px-4 py-3 text-end">{r.captive_pct}%</td>
                <td className="px-4 py-3 text-end font-medium">{formatCurrency(r.captive_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RetentionTable({ report }: { report: RetentionReport }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Invoices with retention" value={String(report.invoice_count)} />
        <StatCard label="Total retention credit" value={formatCurrency(report.total_retention)} />
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Invoice</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Customer</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">NIF</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Labour base</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Retained</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.invoices.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No retention in this period.</td></tr>
            ) : report.invoices.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-gray-600">{r.invoice_date?.slice(0, 10)}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/invoices/${r.id}`} className="text-primary-600 hover:underline">{r.invoice_number}</Link>
                </td>
                <td className="px-4 py-3">{r.customer_name}</td>
                <td className="px-4 py-3 text-gray-500">{r.customer_tax_id ?? '-'}</td>
                <td className="px-4 py-3 text-end text-gray-700">{formatCurrency(r.labour_total)}</td>
                <td className="px-4 py-3 text-end font-medium">{formatCurrency(r.retention_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
