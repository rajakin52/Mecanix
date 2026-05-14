'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { DateRangePicker, todayRange, type DateRange } from '@/components/DateRangePicker';
import { useAbcAnalysis } from '@/hooks/use-purchase-reports';
import { formatCurrency } from '@/lib/format';
import { downloadXlsx } from '@/lib/csv';
import { SkeletonTable } from '@mecanix/ui-web';
import { ChevronLeft } from 'lucide-react';

// Default to current month rather than today — ABC needs enough data
function thisMonth(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startDate: start.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) };
}

export default function AbcAnalysisPage() {
  const [range, setRange] = useState<DateRange>(thisMonth());
  const { data, isLoading } = useAbcAnalysis(range.startDate, range.endDate);

  const handleExport = () => {
    if (!data) return;
    downloadXlsx(`abc-analysis-${range.startDate}_${range.endDate}.csv`, [
      ['Rank', 'Class', 'Part #', 'Description', 'Quantity', 'Revenue', 'Rev %', 'Cumulative %'],
      ...data.rows.map((r) => [
        r.rank, r.class, r.part_number ?? '', r.description, r.quantity,
        r.revenue, r.revenue_pct, r.cumulative_pct,
      ]),
    ]);
  };

  const classBg = (c: 'A' | 'B' | 'C') => c === 'A' ? 'bg-green-100 text-green-800' : c === 'B' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700';

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
          <h1 className="text-2xl font-bold text-gray-900">ABC / Pareto Analysis</h1>
          <p className="text-sm text-gray-500">Class A = top 80% of revenue (the vital few). Class B = next 15%. Class C = the long tail.</p>
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
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Kpi label="Total revenue" value={formatCurrency(data.summary.total_revenue)} />
          <ClassKpi cls="A" items={data.summary.class_A.items} revenue={data.summary.class_A.revenue} />
          <ClassKpi cls="B" items={data.summary.class_B.items} revenue={data.summary.class_B.revenue} />
          <ClassKpi cls="C" items={data.summary.class_C.items} revenue={data.summary.class_C.revenue} />
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th className="text-end">#</Th><Th>Class</Th><Th>Part #</Th><Th>Description</Th>
                <Th className="text-end">Qty sold</Th><Th className="text-end">Revenue</Th>
                <Th className="text-end">Rev %</Th><Th className="text-end">Cumulative %</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {data && data.rows.length > 0 ? (
                data.rows.map((r) => (
                  <tr key={r.rank} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-end text-xs text-gray-500">{r.rank}</td>
                    <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${classBg(r.class)}`}>{r.class}</span></td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.part_number ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{r.description}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{r.quantity}</td>
                    <td className="px-3 py-2 text-end font-medium text-gray-900">{formatCurrency(r.revenue)}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{r.revenue_pct.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-end text-gray-500">{r.cumulative_pct.toFixed(1)}%</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500">No sales in this period.</td></tr>
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
function ClassKpi({ cls, items, revenue }: { cls: 'A' | 'B' | 'C'; items: number; revenue: number }) {
  const tones = { A: 'border-green-200 bg-green-50/40', B: 'border-amber-200 bg-amber-50/40', C: 'border-gray-200 bg-gray-50/40' };
  return (
    <div className={`rounded-lg border p-4 ${tones[cls]}`}>
      <div className="text-xs uppercase text-gray-500">Class {cls}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-semibold text-gray-900">{items}</div>
        <div className="text-xs text-gray-500">items</div>
      </div>
      <div className="mt-0.5 text-sm font-medium text-gray-700">{formatCurrency(revenue)}</div>
    </div>
  );
}
