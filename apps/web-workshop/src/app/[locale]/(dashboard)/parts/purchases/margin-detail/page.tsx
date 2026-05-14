'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { DateRangePicker, todayRange, type DateRange } from '@/components/DateRangePicker';
import { useMarginDetail } from '@/hooks/use-purchase-reports';
import { formatCurrency } from '@/lib/format';
import { downloadXlsx } from '@/lib/csv';
import { SkeletonTable } from '@mecanix/ui-web';
import { ChevronLeft } from 'lucide-react';

function rangeFromQuery(q: string | null): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (q === 'week') { const d = new Date(today); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return { startDate: fmt(d), endDate: fmt(today) }; }
  if (q === 'month') { return { startDate: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: fmt(today) }; }
  if (q === 'ytd') { return { startDate: fmt(new Date(today.getFullYear(), 0, 1)), endDate: fmt(today) }; }
  return todayRange();
}

export default function MarginDetailPage() {
  const sp = useSearchParams();
  const [range, setRange] = useState<DateRange>(todayRange());
  const [mode, setMode] = useState<'issued' | 'invoiced'>('issued');

  useEffect(() => {
    setRange(rangeFromQuery(sp.get('range')));
    const m = sp.get('mode');
    if (m === 'invoiced' || m === 'issued') setMode(m);
  }, [sp]);

  const { data, isLoading } = useMarginDetail(mode, range.startDate, range.endDate);

  const handleExport = () => {
    if (!data) return;
    downloadXlsx(`margin-detail-${mode}-${range.startDate}_${range.endDate}.csv`, [
      ['Part #', 'Description', 'Quantity', 'Revenue', 'Cost', 'Margin', 'Margin %'],
      ...data.rows.map((r) => [
        r.part_number ?? '', r.description, r.quantity, r.revenue, r.cost, r.margin, r.margin_pct,
      ]),
    ]);
  };

  return (
    <div>
      <InventoryTabs />
      <div className="mb-4">
        <Link href="/parts/dashboard" className="inline-flex items-center text-sm text-primary-600 hover:underline">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parts Sale Margin</h1>
          <p className="text-sm text-gray-500">
            Per-part revenue, cost and margin.{' '}
            <span className="font-medium">{mode === 'issued' ? 'Operational' : 'Accounting'} view</span> — by{' '}
            {mode === 'issued' ? 'issue date' : 'invoice date'}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            <button onClick={() => setMode('issued')} className={`rounded-md px-2.5 py-1 text-xs font-medium ${mode === 'issued' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Issued</button>
            <button onClick={() => setMode('invoiced')} className={`rounded-md px-2.5 py-1 text-xs font-medium ${mode === 'invoiced' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Invoiced</button>
          </div>
          <DateRangePicker value={range} onChange={setRange} />
          <button onClick={handleExport} disabled={!data} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Export</button>
        </div>
      </div>

      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="Items" value={String(data.totals.items)} />
          <Kpi label="Revenue" value={formatCurrency(data.totals.revenue)} />
          <Kpi label="Cost" value={formatCurrency(data.totals.cost)} />
          <Kpi label="Margin" value={formatCurrency(data.totals.margin)} />
          <Kpi label="Margin %" value={`${data.totals.margin_pct.toFixed(1)}%`} />
        </div>
      )}

      {isLoading ? <SkeletonTable rows={6} cols={7} /> : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Part #</Th><Th>Description</Th>
                <Th className="text-end">Qty</Th><Th className="text-end">Revenue</Th>
                <Th className="text-end">Cost</Th><Th className="text-end">Margin</Th>
                <Th className="text-end">Margin %</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {data && data.rows.length > 0 ? data.rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.part_number ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{r.description}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{r.quantity}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{formatCurrency(r.revenue)}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{formatCurrency(r.cost)}</td>
                  <td className={`px-3 py-2 text-end font-medium ${r.margin < 0 ? 'text-red-600' : 'text-gray-900'}`}>{formatCurrency(r.margin)}</td>
                  <td className={`px-3 py-2 text-end ${r.margin_pct < 0 ? 'text-red-600' : 'text-gray-700'}`}>{r.margin_pct.toFixed(1)}%</td>
                </tr>
              )) : <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">No sales in this window.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500 ${className}`}>{children}</th>;
}
function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
