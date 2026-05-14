'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { useSlowMoving } from '@/hooks/use-purchase-reports';
import { formatCurrency, formatDate } from '@/lib/format';
import { downloadXlsx } from '@/lib/csv';
import { SkeletonTable } from '@mecanix/ui-web';
import { ChevronLeft } from 'lucide-react';

const PRESETS: Array<{ days: number; label: string }> = [
  { days: 90, label: '90 days' },
  { days: 180, label: '180 days' },
  { days: 365, label: '1 year' },
];

export default function SlowMovingPage() {
  const [days, setDays] = useState(180);
  const { data, isLoading } = useSlowMoving(days);

  const handleExport = () => {
    if (!data) return;
    downloadXlsx(`slow-moving-${days}d-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['Part #', 'Description', 'Category', 'In stock', 'Unit cost', 'Tied-up value', 'Created'],
      ...data.rows.map((r) => [
        r.part_number ?? '', r.description, r.category ?? '',
        r.stock_qty, r.unit_cost, r.tied_up_value, r.created_at,
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
          <h1 className="text-2xl font-bold text-gray-900">Slow-Moving Stock</h1>
          <p className="text-sm text-gray-500">Parts in stock that haven&rsquo;t been issued to a job in the chosen window. Highest tied-up capital first.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  days === p.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
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
          <Kpi label="Parts" value={String(data.totals.parts)} />
          <Kpi label="Units" value={data.totals.units.toLocaleString()} />
          <Kpi label="Tied-up value" value={formatCurrency(data.totals.value)} tone="amber" />
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>Part #</Th><Th>Description</Th><Th>Category</Th>
                <Th className="text-end">Stock</Th><Th className="text-end">Unit cost</Th>
                <Th className="text-end">Tied-up value</Th><Th>Added</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {data && data.rows.length > 0 ? (
                data.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={`/parts/${r.id}`} className="font-mono text-xs text-primary-600 hover:underline">{r.part_number ?? '—'}</Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.description}</td>
                    <td className="px-3 py-2 text-gray-500">{r.category ?? '—'}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{r.stock_qty}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{formatCurrency(r.unit_cost)}</td>
                    <td className="px-3 py-2 text-end font-medium text-amber-700">{formatCurrency(r.tied_up_value)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">{formatDate(r.created_at)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-gray-500">No slow-moving stock in this window. Inventory is healthy.</td></tr>
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
function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'amber' ? 'text-amber-700' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
