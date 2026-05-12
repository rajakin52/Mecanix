'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { DateRangePicker, todayRange, type DateRange } from '@/components/DateRangePicker';
import { usePartsPurchased } from '@/hooks/use-purchase-reports';
import { formatCurrency, formatDate } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { SkeletonTable } from '@mecanix/ui-web';
import { ChevronLeft } from 'lucide-react';

export default function PartsPurchasedPage() {
  const [range, setRange] = useState<DateRange>(todayRange());
  const { data, isLoading } = usePartsPurchased(range.startDate, range.endDate);

  const handleExport = () => {
    if (!data) return;
    downloadCsv(`parts-purchased-${range.startDate}_${range.endDate}.csv`, [
      ['Date', 'Source', 'Document', 'Vendor', 'Part #', 'Description', 'Qty', 'Received', 'Unit cost', 'Total'],
      ...data.lines.map((l) => [
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
          <Kpi label="Lines" value={String(data.totals.line_count)} />
          <Kpi label="Units" value={data.totals.quantity.toLocaleString()} />
          <Kpi label="Total value" value={formatCurrency(data.totals.value)} />
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
              {data && data.lines.length > 0 ? (
                data.lines.map((l, i) => (
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
