'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApplyLandedCosts, type LandedCostInput } from '@/hooks/use-purchases';
import { useToast } from '@mecanix/ui-web';
import { formatCurrency } from '@/lib/format';
import { Plus, Trash2, Sparkles } from 'lucide-react';

const COST_TYPES = [
  'Customs duty',
  'Freight',
  'Insurance',
  'Handling / Clearing',
  'Local transport',
  'Other',
];

interface ExistingCost {
  type: string;
  amount: number;
  allocation_method?: 'by_value' | 'by_quantity';
}

interface LineLike {
  id: string;
  description?: string;
  part_id?: string | null;
  quantity: number;
  unit_cost: number;
  landed_unit_cost?: number | null;
}

interface CostRow {
  type: string;
  amount: string;
  allocation_method: 'by_value' | 'by_quantity';
}

const EMPTY_ROW: CostRow = { type: 'Customs duty', amount: '', allocation_method: 'by_value' };

export function LandedCostsPanel({
  poId,
  lines,
  initialCosts,
}: {
  poId: string;
  lines: LineLike[];
  initialCosts?: ExistingCost[];
}) {
  const toast = useToast();
  const apply = useApplyLandedCosts(poId);

  const [rows, setRows] = useState<CostRow[]>(
    initialCosts && initialCosts.length > 0
      ? initialCosts.map((c) => ({
          type: c.type,
          amount: String(c.amount),
          allocation_method: c.allocation_method ?? 'by_value',
        }))
      : [{ ...EMPTY_ROW }],
  );

  // Keep state in sync if the parent reloads with fresh costs
  useEffect(() => {
    if (initialCosts && initialCosts.length > 0) {
      setRows(initialCosts.map((c) => ({
        type: c.type,
        amount: String(c.amount),
        allocation_method: c.allocation_method ?? 'by_value',
      })));
    }
  }, [initialCosts]);

  // Live preview: compute per-line landed unit cost as the user edits
  const preview = useMemo(() => {
    const totalValue = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_cost), 0);
    const totalQty = lines.reduce((s, l) => s + Number(l.quantity), 0);
    const perUnitAddOn = lines.map(() => 0);

    for (const r of rows) {
      const amt = Number(r.amount) || 0;
      if (amt <= 0) continue;
      if (r.allocation_method === 'by_quantity') {
        if (totalQty <= 0) continue;
        const perUnit = amt / totalQty;
        for (let i = 0; i < lines.length; i++) perUnitAddOn[i] = (perUnitAddOn[i] ?? 0) + perUnit;
      } else {
        if (totalValue <= 0) continue;
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i]!;
          const proportion = (Number(l.quantity) * Number(l.unit_cost)) / totalValue;
          if (l.quantity > 0) perUnitAddOn[i] = (perUnitAddOn[i] ?? 0) + (amt * proportion) / Number(l.quantity);
        }
      }
    }
    return lines.map((l, i) => {
      const addOn = perUnitAddOn[i] ?? 0;
      return {
        ...l,
        landed_preview: Math.round((Number(l.unit_cost) + addOn) * 100) / 100,
        add_on: Math.round(addOn * 100) / 100,
      };
    });
  }, [lines, rows]);

  const totalCost = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const totalPOValue = lines.reduce((s, l) => s + Number(l.quantity) * Number(l.unit_cost), 0);

  const update = (i: number, patch: Partial<CostRow>) => {
    setRows((rows) => {
      const next = [...rows];
      const cur = next[i];
      if (!cur) return rows;
      next[i] = { ...cur, ...patch };
      return next;
    });
  };

  const handleApply = async () => {
    const clean: LandedCostInput[] = rows
      .filter((r) => Number(r.amount) > 0)
      .map((r) => ({
        type: r.type.trim() || 'Other',
        amount: Number(r.amount),
        allocation_method: r.allocation_method,
      }));
    if (clean.length === 0) {
      toast.error('Add at least one cost with an amount > 0');
      return;
    }
    try {
      await apply.mutateAsync(clean);
      toast.success('Landed costs applied — line costs updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to apply');
    }
  };

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Landed costs</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Distribute customs duty, freight, insurance and other import expenses across the lines so inventory reflects true cost.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-12 gap-2 rounded-md border border-gray-200 bg-gray-50 p-2">
            <div className="col-span-5 sm:col-span-4">
              <label className="block text-xs text-gray-500">Type</label>
              <input
                list={`cost-types-${idx}`}
                value={row.type}
                onChange={(e) => update(idx, { type: e.target.value })}
                className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <datalist id={`cost-types-${idx}`}>
                {COST_TYPES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="col-span-4 sm:col-span-3">
              <label className="block text-xs text-gray-500">Amount</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={row.amount}
                onChange={(e) => update(idx, { amount: e.target.value })}
                className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div className="col-span-3 sm:col-span-4">
              <label className="block text-xs text-gray-500">Allocation</label>
              <select
                value={row.allocation_method}
                onChange={(e) => update(idx, { allocation_method: e.target.value as 'by_value' | 'by_quantity' })}
                className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="by_value">By value</option>
                <option value="by_quantity">By quantity</option>
              </select>
            </div>
            <div className="col-span-12 flex items-end justify-end sm:col-span-1">
              <button
                type="button"
                onClick={() => setRows((r) => r.filter((_, i) => i !== idx))}
                disabled={rows.length === 1}
                className="rounded-md p-1 text-red-500 hover:bg-red-50 disabled:opacity-30"
                aria-label="Remove cost"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((r) => [...r, { ...EMPTY_ROW }])}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <Plus className="h-4 w-4" /> Add cost
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-gray-200 pt-4">
        <div className="text-sm">
          <div className="text-xs text-gray-500">PO value vs landed costs</div>
          <div className="mt-0.5">
            <span className="font-medium text-gray-900">{formatCurrency(totalPOValue)}</span>
            <span className="mx-2 text-gray-300">+</span>
            <span className="font-medium text-amber-700">{formatCurrency(totalCost)}</span>
            <span className="mx-2 text-gray-300">=</span>
            <span className="font-semibold text-gray-900">{formatCurrency(totalPOValue + totalCost)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleApply}
          disabled={apply.isPending || totalCost <= 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {apply.isPending ? 'Applying…' : 'Apply landed costs'}
        </button>
      </div>

      {totalCost > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Preview — per-line landed cost
          </div>
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Line</th>
                  <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Qty</th>
                  <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Unit cost</th>
                  <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">+ Add-on</th>
                  <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">= Landed</th>
                  <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Δ %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((p) => {
                  const orig = Number(p.unit_cost);
                  const pct = orig > 0 ? ((p.landed_preview - orig) / orig) * 100 : 0;
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-gray-700">{p.description ?? '—'}</td>
                      <td className="px-3 py-2 text-end text-gray-700">{p.quantity}</td>
                      <td className="px-3 py-2 text-end text-gray-700">{formatCurrency(orig)}</td>
                      <td className="px-3 py-2 text-end text-amber-700">{formatCurrency(p.add_on)}</td>
                      <td className="px-3 py-2 text-end font-medium text-gray-900">{formatCurrency(p.landed_preview)}</td>
                      <td className="px-3 py-2 text-end text-xs text-gray-500">+{pct.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
