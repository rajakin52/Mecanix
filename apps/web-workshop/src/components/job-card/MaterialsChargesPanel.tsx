'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { useToast } from '@mecanix/ui-web';
import { PaintBucket, Sparkles, RefreshCw } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type ChargeType = 'refinish' | 'body' | 'shop_supplies';
type RateSource = 'customer' | 'insurance' | 'tenant' | 'none';

interface MaterialsCharge {
  type: ChargeType;
  description: string;
  hours_basis: number;
  rate: number;
  rate_source: RateSource;
  subtotal: number;
}

interface MaterialsPreview {
  job_card_id: string;
  job_number: string | null;
  labour_totals: { mechanical: number; body: number; refinish: number; detail: number };
  mechanical_labour_value: number;
  rates_applied: {
    materials_rate_refinish: number | null;
    materials_rate_body: number | null;
    shop_supplies_pct: number | null;
    shop_supplies_cap: number | null;
  };
  charges: MaterialsCharge[];
  total: number;
}

const SOURCE_LABEL: Record<RateSource, string> = {
  customer: 'customer override',
  insurance: 'insurance override',
  tenant: 'tenant default',
  none: 'not set',
};

const SOURCE_BG: Record<RateSource, string> = {
  customer: 'bg-purple-100 text-purple-800',
  insurance: 'bg-blue-100 text-blue-800',
  tenant: 'bg-gray-100 text-gray-700',
  none: 'bg-red-100 text-red-800',
};

const TYPE_LABEL: Record<ChargeType, string> = {
  refinish: 'Refinish materials',
  body: 'Body materials',
  shop_supplies: 'Shop supplies',
};

export function MaterialsChargesPanel({ jobCardId }: { jobCardId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [collapsed, setCollapsed] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['materials-preview', jobCardId],
    queryFn: () => api.get<MaterialsPreview>(`/jobs/${jobCardId}/materials-preview`),
  });

  const apply = useMutation({
    mutationFn: () => api.post(`/jobs/${jobCardId}/materials-apply`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials-preview', jobCardId] });
      qc.invalidateQueries({ queryKey: ['parts-lines', jobCardId] });
      qc.invalidateQueries({ queryKey: ['job', jobCardId] });
      toast.success('Materials charges applied to job');
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Apply failed'),
  });

  if (isLoading || !data) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <PaintBucket className="h-4 w-4" /> Materials charges
        </div>
        <p className="mt-2 text-xs text-gray-400">Loading preview…</p>
      </div>
    );
  }

  const hasCharges = data.charges.length > 0;
  const noRatesSet = !hasCharges && Object.values(data.rates_applied).every((v) => v == null);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <PaintBucket className="h-4 w-4 text-primary-600" />
          <span className="text-sm font-semibold text-gray-900">Materials charges</span>
          {hasCharges && (
            <span className="rounded bg-primary-50 px-1.5 py-0.5 text-xs font-medium text-primary-700">
              {formatCurrency(data.total)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded p-1 text-gray-400 hover:text-gray-600"
            title="Refresh preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
          >
            {collapsed ? 'show' : 'hide'}
          </button>
        </div>
      </div>

      {collapsed ? null : (
        <div className="px-4 py-3">
          {noRatesSet ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No materials rates configured.{' '}
              <Link href="/settings/materials-rates" className="font-medium underline">
                Set rates →
              </Link>
            </div>
          ) : !hasCharges ? (
            <p className="text-xs text-gray-500">
              No materials charges apply yet. Add refinish, body or mechanical labour lines, then refresh.
            </p>
          ) : (
            <>
              <table className="min-w-full text-sm">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="pb-2 text-start font-medium">Type</th>
                    <th className="pb-2 text-start font-medium">Basis</th>
                    <th className="pb-2 text-start font-medium">Source</th>
                    <th className="pb-2 text-end font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.charges.map((c) => (
                    <tr key={c.type}>
                      <td className="py-2 font-medium text-gray-900">{TYPE_LABEL[c.type]}</td>
                      <td className="py-2 text-xs text-gray-600">
                        {c.type === 'shop_supplies'
                          ? `${(c.rate * 100).toFixed(1)}% × ${formatCurrency(data.mechanical_labour_value)} mech labour`
                          : `${c.hours_basis} hrs × ${formatCurrency(c.rate)}/hr`}
                      </td>
                      <td className="py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${SOURCE_BG[c.rate_source]}`}>
                          {SOURCE_LABEL[c.rate_source]}
                        </span>
                      </td>
                      <td className="py-2 text-end font-medium text-gray-900">{formatCurrency(c.subtotal)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300">
                    <td colSpan={3} className="py-2 text-end text-sm font-semibold text-gray-700">Total</td>
                    <td className="py-2 text-end text-base font-bold text-gray-900">{formatCurrency(data.total)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Apply will add these as line items on the job (idempotent — re-running replaces previous materials lines).
                </p>
                <button
                  type="button"
                  onClick={() => apply.mutate()}
                  disabled={apply.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {apply.isPending ? 'Applying…' : 'Apply to job'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
