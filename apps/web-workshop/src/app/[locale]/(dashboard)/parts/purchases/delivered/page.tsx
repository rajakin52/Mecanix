'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { DateRangePicker, todayRange, type DateRange } from '@/components/DateRangePicker';
import { usePartsDelivered } from '@/hooks/use-purchase-reports';
import { formatCurrency, formatDate } from '@/lib/format';
import { downloadXlsx } from '@/lib/csv';
import { SkeletonTable } from '@mecanix/ui-web';
import { ChevronLeft } from 'lucide-react';

function rangeFromQuery(q: string | null): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  if (q === 'week') {
    const d = new Date(today); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return { startDate: fmt(d), endDate: fmt(today) };
  }
  if (q === 'month') {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: fmt(d), endDate: fmt(today) };
  }
  if (q === 'ytd') {
    const d = new Date(today.getFullYear(), 0, 1);
    return { startDate: fmt(d), endDate: fmt(today) };
  }
  return todayRange();
}

export default function DeliveredPage() {
  const sp = useSearchParams();
  const [range, setRange] = useState<DateRange>(todayRange());

  useEffect(() => {
    setRange(rangeFromQuery(sp.get('range')));
  }, [sp]);

  const { data, isLoading } = usePartsDelivered(range.startDate, range.endDate);

  const handleExport = () => {
    if (!data) return;
    downloadXlsx(`parts-delivered-${range.startDate}_${range.endDate}.csv`, [
      ['Issued at', 'Part #', 'Description', 'Qty', 'Unit cost', 'Sell price', 'Revenue', 'Margin', 'Job', 'Status', 'Customer', 'Plate'],
      ...data.rows.map((r) => [
        r.issued_at, r.part_number ?? '', r.description, r.quantity, r.unit_cost, r.sell_price,
        r.subtotal, r.margin, r.job_number ?? '', r.job_status ?? '', r.customer_name ?? '', r.vehicle_plate ?? '',
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
          <h1 className="text-2xl font-bold text-gray-900">Parts Delivered (Issued)</h1>
          <p className="text-sm text-gray-500">Parts that left the warehouse to a job in the window. Operational view — does not depend on invoicing.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button onClick={handleExport} disabled={!data} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Export</button>
        </div>
      </div>

      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label="Lines" value={String(data.totals.lines)} />
          <Kpi label="Units" value={data.totals.quantity.toLocaleString()} />
          <Kpi label="Revenue" value={formatCurrency(data.totals.revenue)} />
          <Kpi label="Cost" value={formatCurrency(data.totals.cost)} />
          <Kpi label="Margin" value={formatCurrency(data.totals.margin)} />
        </div>
      )}

      {isLoading ? <SkeletonTable rows={6} cols={9} /> : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Issued</Th><Th>Part #</Th><Th>Description</Th>
                <Th className="text-end">Qty</Th><Th className="text-end">Revenue</Th>
                <Th className="text-end">Margin</Th><Th>Job</Th><Th>Customer</Th><Th>Plate</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {data && data.rows.length > 0 ? data.rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-500">{formatDate(r.issued_at)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.part_number ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{r.description}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{r.quantity}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{formatCurrency(r.subtotal)}</td>
                  <td className="px-3 py-2 text-end font-medium text-gray-900">{formatCurrency(r.margin)}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.job_number ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{r.customer_name ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.vehicle_plate ?? '—'}</td>
                </tr>
              )) : <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">No parts issued in this window.</td></tr>}
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
