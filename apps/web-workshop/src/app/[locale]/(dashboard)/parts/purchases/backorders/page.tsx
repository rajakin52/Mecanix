'use client';

import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { useBackorders } from '@/hooks/use-purchase-reports';
import { formatCurrency } from '@/lib/format';
import { downloadCsv } from '@/lib/csv';
import { SkeletonTable } from '@mecanix/ui-web';
import { ChevronLeft } from 'lucide-react';

export default function BackordersPage() {
  const { data, isLoading } = useBackorders();
  const handleExport = () => {
    if (!data) return;
    downloadCsv(`backorders-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Part #', 'Description', 'Category', 'Stock', 'Reserved', 'Shortfall', 'Reorder pt', 'Unit cost'],
      ...data.rows.map((r) => [
        r.part_number ?? '', r.description, r.category ?? '',
        r.stock_qty, r.reserved_qty, -r.available, r.reorder_point, r.unit_cost,
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
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backorders</h1>
          <p className="text-sm text-gray-500">Parts whose reserved quantity exceeds physical stock — you&rsquo;ve committed more than you have.</p>
        </div>
        <button onClick={handleExport} disabled={!data} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Export</button>
      </div>

      {isLoading ? <SkeletonTable rows={6} cols={8} /> : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Part #</Th><Th>Description</Th><Th>Category</Th>
                <Th className="text-end">Stock</Th><Th className="text-end">Reserved</Th>
                <Th className="text-end">Shortfall</Th><Th className="text-end">Reorder pt</Th>
                <Th className="text-end">Unit cost</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {data && data.rows.length > 0 ? data.rows.map((r) => (
                <tr key={r.id} className="bg-red-50/40 hover:bg-red-50">
                  <td className="px-3 py-2"><Link href={`/parts/${r.id}`} className="font-mono text-xs text-primary-600 hover:underline">{r.part_number ?? '—'}</Link></td>
                  <td className="px-3 py-2 text-gray-700">{r.description}</td>
                  <td className="px-3 py-2 text-gray-500">{r.category ?? '—'}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{r.stock_qty}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{r.reserved_qty}</td>
                  <td className="px-3 py-2 text-end font-bold text-red-600">{-r.available}</td>
                  <td className="px-3 py-2 text-end text-gray-500">{r.reorder_point}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{formatCurrency(r.unit_cost)}</td>
                </tr>
              )) : <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-green-700">No backorders. Reservations are within stock.</td></tr>}
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
