'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useReorderSuggestions, type ReorderSuggestion } from '@/hooks/use-reorder';
import { useCreatePurchaseOrder } from '@/hooks/use-purchases';
import { formatCurrency } from '@/lib/format';
import { SkeletonTable, EmptyState, useToast } from '@mecanix/ui-web';

const PRIORITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  watch: 'bg-gray-100 text-gray-600',
};

export default function ReorderSuggestionsPage() {
  const toast = useToast();
  const { data, isLoading, isError, error } = useReorderSuggestions();
  const createPo = useCreatePurchaseOrder();

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, number>>({});

  const rows = (data ?? []) as ReorderSuggestion[];

  const byVendor = useMemo(() => {
    const map = new Map<string, { vendorId: string | null; vendorName: string; items: ReorderSuggestion[] }>();
    for (const r of rows) {
      const vid = r.vendor?.id ?? '__nov';
      const vname = r.vendor?.name ?? 'No vendor assigned';
      if (!map.has(vid)) map.set(vid, { vendorId: r.vendor?.id ?? null, vendorName: vname, items: [] });
      map.get(vid)!.items.push(r);
    }
    return Array.from(map.values());
  }, [rows]);

  const totals = useMemo(() => {
    let critical = 0;
    let warning = 0;
    let watch = 0;
    let est = 0;
    for (const r of rows) {
      if (r.priority === 'critical') critical++;
      else if (r.priority === 'warning') warning++;
      else watch++;
      est += r.estimated_cost;
    }
    return { critical, warning, watch, est };
  }, [rows]);

  const qtyFor = (r: ReorderSuggestion) => overrides[r.part_id] ?? r.suggested_qty;

  const createPoForVendor = async (
    vendorId: string | null,
    vendorName: string,
    items: ReorderSuggestion[],
  ) => {
    if (!vendorId) {
      toast.error(`${vendorName}: assign a vendor to these parts first.`);
      return;
    }
    const picked = items.filter((r) => selected[r.part_id] !== false);
    if (picked.length === 0) {
      toast.error('No items selected for this vendor.');
      return;
    }
    try {
      await createPo.mutateAsync({
        vendorId,
        notes: `Auto-generated from reorder suggestions (${picked.length} line${picked.length === 1 ? '' : 's'})`,
        lines: picked.map((r) => ({
          partId: r.part_id,
          quantity: qtyFor(r),
          unitCost: r.unit_cost,
        })),
      } as unknown as Parameters<typeof createPo.mutateAsync>[0]);
      toast.success(`Draft PO created for ${vendorName}`);
      // Clear selections for this vendor
      setSelected((prev) => {
        const next = { ...prev };
        for (const r of items) delete next[r.part_id];
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create PO');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reorder suggestions</h1>
          <p className="mt-1 text-sm text-gray-600">
            Based on 90-day sell-through. Target two weeks of cover for every hot-mover. Human
            confirms every suggestion before a PO is drafted.
          </p>
        </div>
        <Link
          href="/purchase-orders"
          className="text-sm text-primary-600 hover:underline"
        >
          Purchase orders &rarr;
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Kpi label="Critical" value={String(totals.critical)} color="text-red-600" />
        <Kpi label="Warning" value={String(totals.warning)} color="text-yellow-600" />
        <Kpi label="Watch" value={String(totals.watch)} />
        <Kpi label="Estimated cost" value={formatCurrency(totals.est)} color="text-gray-900" />
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Failed to load: {error instanceof Error ? error.message : 'unknown'}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="parts"
          title="Nothing to reorder right now"
          description="Parts with issuances in the last 90 days have enough cover. Come back after the next busy week."
        />
      ) : (
        <div className="space-y-6">
          {byVendor.map((group) => (
            <div key={group.vendorId ?? 'novendor'} className="rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">{group.vendorName}</h2>
                  <p className="text-xs text-gray-500">
                    {group.items.length} part{group.items.length === 1 ? '' : 's'} to reorder
                    {' · '}
                    est. {formatCurrency(group.items.reduce((s, r) => s + r.estimated_cost, 0))}
                  </p>
                </div>
                <button
                  onClick={() => createPoForVendor(group.vendorId, group.vendorName, group.items)}
                  disabled={!group.vendorId || createPo.isPending}
                  className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
                >
                  {group.vendorId ? 'Create draft PO' : 'Assign a vendor first'}
                </button>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-8 px-3 py-2"></th>
                    <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Part</th>
                    <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Velocity</th>
                    <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Available</th>
                    <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Days cover</th>
                    <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Priority</th>
                    <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Est. cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {group.items.map((r) => {
                    const isSelected = selected[r.part_id] !== false;
                    const qty = qtyFor(r);
                    const cost = qty * r.unit_cost;
                    return (
                      <tr key={r.part_id} className={isSelected ? '' : 'opacity-40'}>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => setSelected({ ...selected, [r.part_id]: e.target.checked })}
                          />
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <div className="font-medium text-gray-900">{r.description}</div>
                          <div className="text-xs text-gray-500 font-mono">{r.part_number}</div>
                        </td>
                        <td className="px-3 py-2 text-end text-sm text-gray-700">
                          {r.velocity_per_day.toFixed(2)}/d
                          <div className="text-xs text-gray-400">{r.issued_last_90d} in 90d</div>
                        </td>
                        <td className="px-3 py-2 text-end text-sm text-gray-700">{r.available}</td>
                        <td className="px-3 py-2 text-end text-sm text-gray-700">
                          {r.days_of_cover != null ? `${r.days_of_cover}d` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLOR[r.priority]}`}>
                            {r.priority}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-end">
                          <input
                            type="number"
                            min={1}
                            value={qty}
                            onChange={(e) => setOverrides({ ...overrides, [r.part_id]: Math.max(1, Number(e.target.value) || 1) })}
                            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-end text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-end text-sm text-gray-700">{formatCurrency(cost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
