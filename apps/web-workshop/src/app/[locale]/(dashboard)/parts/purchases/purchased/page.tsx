'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { DateRangePicker, todayRange, type DateRange } from '@/components/DateRangePicker';
import { usePartsPurchased } from '@/hooks/use-purchase-reports';
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
  if (q === 'month') return { startDate: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), endDate: fmt(today) };
  return todayRange();
}

export default function PartsPurchasedPage() {
  const sp = useSearchParams();
  const [range, setRange] = useState<DateRange>(todayRange());
  useEffect(() => { setRange(rangeFromQuery(sp.get('range'))); }, [sp]);
  const sourceFilter = sp.get('source') as 'po' | 'bill' | null;
  const { data, isLoading } = usePartsPurchased(range.startDate, range.endDate);

  const filteredLines = data
    ? sourceFilter
      ? data.lines.filter((l) => l.source === sourceFilter)
      : data.lines
    : [];

  const handleExport = () => {
    if (!data) return;
    downloadXlsx(`parts-purchased-${range.startDate}_${range.endDate}.csv`, [
      ['Date', 'Source', 'Document', 'Vendor', 'Part #', 'Description', 'Qty', 'Received', 'Unit cost', 'Total'],
      ...filteredLines.map((l) => [
        l.date, l.source, l.document, l.vendor_name ?? '', l.part_number ?? '',
        l.description, l.quantity, l.received_qty, l.unit_cost, l.total,
      ]),
    ]);
  };

  return (
    <div>
      <InventoryTabs />
      <div className="mb-4">
        <Link href="/parts/purchases" className="inline-flex items-center text-sm text-primary-600 hover:underline">
          <ChevronLeft className="h-4 w-4" /> Purchases &amp; Reports
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parts Purchased</h1>
          <p className="text-sm text-gray-500">PO lines (by order date) and approved bill lines (by bill date) within the period.</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <button
            onClick={handleExport}
            disabled={!data}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Export
          </button>
        </div>
      </div>

      {data && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi label="Lines" value={String(filteredLines.length)} />
          <Kpi label="Units" value={filteredLines.reduce((s, l) => s + Number(l.quantity || 0), 0).toLocaleString()} />
          <Kpi label="Total value" value={formatCurrency(filteredLines.reduce((s, l) => s + Number(l.total || 0), 0))} />
        </div>
      )}
      {sourceFilter && (
        <div className="mb-3 rounded-md bg-blue-50 px-3 py-1.5 text-xs text-blue-800">
          Filtered to <strong>{sourceFilter === 'po' ? 'Purchase Orders' : 'Bills'}</strong> only.{' '}
          <Link href="/parts/purchases/purchased" className="underline">Clear</Link>
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={6} cols={9} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Date</Th>
                <Th>Source</Th>
                <Th>Document</Th>
                <Th>Vendor</Th>
                <Th>Part #</Th>
                <Th>Description</Th>
                <Th className="text-end">Qty</Th>
                <Th className="text-end">Received</Th>
                <Th className="text-end">Unit cost</Th>
                <Th className="text-end">Total</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {filteredLines.length > 0 ? (
                filteredLines.map((l, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{formatDate(l.date)}</td>
                    <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs ${l.source === 'po' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{l.source.toUpperCase()}</span></td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{l.document}</td>
                    <td className="px-3 py-2 text-gray-700">{l.vendor_name ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{l.part_number ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{l.description}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{l.quantity}</td>
                    <td className={`px-3 py-2 text-end ${l.received_qty < l.quantity ? 'text-amber-700' : 'text-green-700'}`}>{l.received_qty}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{formatCurrency(l.unit_cost)}</td>
                    <td className="px-3 py-2 text-end font-medium text-gray-900">{formatCurrency(l.total)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500">No purchases in this period.</td></tr>
              )}
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
