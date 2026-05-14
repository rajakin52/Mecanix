'use client';

import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { useConsumablesStock } from '@/hooks/use-purchase-reports';
import { formatCurrency } from '@/lib/format';
import { downloadXlsx } from '@/lib/csv';
import { SkeletonTable } from '@mecanix/ui-web';
import { ChevronLeft } from 'lucide-react';

export default function ConsumablesPage() {
  const { data, isLoading } = useConsumablesStock();

  const handleExport = () => {
    if (!data) return;
    downloadXlsx(`consumables-stock-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Part #', 'Description', 'Category', 'Location', 'Stock', 'Reserved', 'Available', 'Reorder pt', 'Unit cost', 'Stock value'],
      ...data.rows.map((r) => [
        r.part_number ?? '', r.description, r.category ?? '', r.location ?? '',
        r.stock_qty, r.reserved_qty, r.available, r.reorder_point, r.unit_cost, r.stock_value,
      ]),
    ]);
  };

  return (
    <div>
      <InventoryTabs />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/parts/dashboard" className="inline-flex items-center text-primary-600 hover:underline">
          <ChevronLeft className="h-4 w-4" /> Dashboard
        </Link>
        <span className="text-gray-300">·</span>
        <Link href="/parts/purchases" className="text-gray-600 hover:text-primary-600">
          Purchases &amp; Reports
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consumables on Hand</h1>
          <p className="text-sm text-gray-500">Parts flagged as consumable in the catalogue (oil, fluids, paint, filters, cleaning products).</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/parts?consumable=true"
            className="rounded-md border border-primary-200 bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700 hover:bg-primary-100"
          >
            Manage in Catalogue
          </Link>
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
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Kpi label="Consumable parts" value={String(data.totals.parts)} />
          <Kpi label="Units in stock" value={data.totals.units.toLocaleString()} />
          <Kpi label="Stock value" value={formatCurrency(data.totals.value)} />
          <Kpi label="Below reorder" value={String(data.totals.below_reorder)} tone={data.totals.below_reorder > 0 ? 'red' : undefined} />
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={6} cols={9} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Part #</Th><Th>Description</Th><Th>Category</Th><Th>Location</Th>
                <Th className="text-end">Stock</Th><Th className="text-end">Reserved</Th>
                <Th className="text-end">Available</Th><Th className="text-end">Reorder</Th>
                <Th className="text-end">Value</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {data && data.rows.length > 0 ? (
                data.rows.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50 ${r.below_reorder ? 'bg-red-50/40' : ''}`}>
                    <td className="px-3 py-2">
                      <Link href={`/parts/${r.id}`} className="font-mono text-xs text-primary-600 hover:underline">{r.part_number ?? '—'}</Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.description}</td>
                    <td className="px-3 py-2 text-gray-500">{r.category ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{r.location ?? '—'}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{r.stock_qty}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{r.reserved_qty}</td>
                    <td className={`px-3 py-2 text-end font-medium ${r.below_reorder ? 'text-red-600' : 'text-gray-900'}`}>{r.available}</td>
                    <td className="px-3 py-2 text-end text-gray-500">{r.reorder_point}</td>
                    <td className="px-3 py-2 text-end text-gray-900">{formatCurrency(r.stock_value)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500">No parts flagged as consumable. Edit a part and tick &ldquo;Consumable&rdquo; to populate this list.</td></tr>
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
function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'red' }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'red' ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
