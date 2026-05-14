'use client';

import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { useStockValuation } from '@/hooks/use-purchase-reports';
import { formatCurrency } from '@/lib/format';
import { downloadXlsx } from '@/lib/csv';
import { SkeletonTable } from '@mecanix/ui-web';
import { ChevronLeft } from 'lucide-react';

export default function StockValuationPage() {
  const { data, isLoading } = useStockValuation();
  const handleExport = () => {
    if (!data) return;
    downloadXlsx(`stock-valuation-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Part #', 'Description', 'Category', 'Location', 'Stock', 'Reserved', 'Available', 'Unit cost', 'Stock value', 'Sell price', 'Potential revenue'],
      ...data.rows.map((r) => [
        r.part_number ?? '', r.description, r.category ?? '', r.location ?? '',
        r.stock_qty, r.reserved_qty, r.available, r.unit_cost, r.stock_value, r.sell_price, r.potential_revenue,
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
          <h1 className="text-2xl font-bold text-gray-900">Stock Valuation</h1>
          <p className="text-sm text-gray-500">Every active part with stock, ranked by stock value (stock × unit cost).</p>
        </div>
        <button onClick={handleExport} disabled={!data} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Export</button>
      </div>

      {data && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Parts in stock" value={String(data.totals.parts)} />
          <Kpi label="Total units" value={data.totals.units.toLocaleString()} />
          <Kpi label="Stock value (cost)" value={formatCurrency(data.totals.value)} />
          <Kpi label="Potential revenue" value={formatCurrency(data.totals.potential_revenue)} />
        </div>
      )}

      {isLoading ? <SkeletonTable rows={6} cols={9} /> : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Part #</Th><Th>Description</Th><Th>Category</Th><Th>Location</Th>
                <Th className="text-end">Stock</Th><Th className="text-end">Reserved</Th>
                <Th className="text-end">Available</Th><Th className="text-end">Unit cost</Th>
                <Th className="text-end">Stock value</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {data && data.rows.length > 0 ? data.rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2"><Link href={`/parts/${r.id}`} className="font-mono text-xs text-primary-600 hover:underline">{r.part_number ?? '—'}</Link></td>
                  <td className="px-3 py-2 text-gray-700">{r.description}</td>
                  <td className="px-3 py-2 text-gray-500">{r.category ?? '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{r.location ?? '—'}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{r.stock_qty}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{r.reserved_qty}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{r.available}</td>
                  <td className="px-3 py-2 text-end text-gray-700">{formatCurrency(r.unit_cost)}</td>
                  <td className="px-3 py-2 text-end font-medium text-gray-900">{formatCurrency(r.stock_value)}</td>
                </tr>
              )) : <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">No stock yet.</td></tr>}
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
