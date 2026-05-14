'use client';

import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { useLowStockDetail } from '@/hooks/use-purchase-reports';
import { formatCurrency } from '@/lib/format';
import { downloadXlsx } from '@/lib/csv';
import { SkeletonTable } from '@mecanix/ui-web';
import { ChevronLeft } from 'lucide-react';

export default function LowStockPage() {
  const { data, isLoading } = useLowStockDetail();

  const handleExport = () => {
    if (!data) return;
    downloadXlsx(`low-stock-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Part #', 'Description', 'Category', 'Location', 'Vendor', 'Stock', 'Reserved', 'Available', 'Reorder pt', 'Shortfall', 'Unit cost', 'Replenish value'],
      ...data.rows.map((r) => [
        r.part_number ?? '', r.description, r.category ?? '', r.location ?? '', r.vendor_name ?? '',
        r.stock_qty, r.reserved_qty, r.available, r.reorder_point, r.shortfall, r.unit_cost, r.replenish_value,
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
          <h1 className="text-2xl font-bold text-gray-900">Low Stock</h1>
          <p className="text-sm text-gray-500">
            Active parts where available stock (stock − reserved) is at or below the reorder point. Out-of-stock items are included.
          </p>
        </div>
        <button onClick={handleExport} disabled={!data} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          Export
        </button>
      </div>

      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Parts below reorder" value={String(data.totals.parts)} tone={data.totals.parts > 0 ? 'amber' : undefined} />
          <Kpi label="of which out of stock" value={String(data.totals.out_of_stock)} tone={data.totals.out_of_stock > 0 ? 'red' : undefined} />
          <Kpi label="Shortfall (units)" value={data.totals.shortfall_units.toLocaleString()} />
          <Kpi label="Replenish value (cost)" value={formatCurrency(data.totals.replenish_value)} />
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={6} cols={9} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Part #</Th><Th>Description</Th><Th>Vendor</Th>
                <Th className="text-end">Stock</Th><Th className="text-end">Reserved</Th>
                <Th className="text-end">Available</Th><Th className="text-end">Reorder</Th>
                <Th className="text-end">Shortfall</Th><Th className="text-end">Replenish value</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {data && data.rows.length > 0 ? (
                data.rows.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${r.out_of_stock ? 'bg-red-50/40' : 'bg-amber-50/30'}`}>
                    <td className="px-3 py-2">
                      <Link href={`/parts/${r.id}`} className="font-mono text-xs text-primary-600 hover:underline">{r.part_number ?? '—'}</Link>
                      {r.out_of_stock && (
                        <span className="ms-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">out of stock</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.description}</td>
                    <td className="px-3 py-2 text-gray-500">{r.vendor_name ?? '—'}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{r.stock_qty}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{r.reserved_qty}</td>
                    <td className={`px-3 py-2 text-end font-medium ${r.available <= 0 ? 'text-red-600' : 'text-amber-700'}`}>{r.available}</td>
                    <td className="px-3 py-2 text-end text-gray-500">{r.reorder_point}</td>
                    <td className="px-3 py-2 text-end font-medium text-gray-900">{r.shortfall}</td>
                    <td className="px-3 py-2 text-end text-gray-900">{formatCurrency(r.replenish_value)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-green-700">All parts are above their reorder points. 🎉</td></tr>
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
function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'amber' }) {
  const cls = tone === 'red' ? 'text-red-600' : tone === 'amber' ? 'text-amber-700' : 'text-gray-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
