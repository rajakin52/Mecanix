'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useClaims } from '@/hooks/use-insurance-portal';
import { Link } from '@/i18n/navigation';

const STATUS_TABS = [
  { key: undefined, label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'partially_approved', label: 'Partial' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'in_repair', label: 'In Repair' },
  { key: 'completed', label: 'Completed' },
  { key: 'paid', label: 'Paid' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  initiated: 'bg-gray-100 text-gray-700',
  documented: 'bg-blue-100 text-blue-700',
  submitted: 'bg-indigo-100 text-indigo-700',
  under_review: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  partially_approved: 'bg-lime-100 text-lime-700',
  rejected: 'bg-red-100 text-red-700',
  in_repair: 'bg-blue-100 text-blue-600',
  completed: 'bg-green-100 text-green-600',
  paid: 'bg-gray-200 text-gray-500',
};

export default function ClaimsPage() {
  const t = useTranslations('portal');

  const [page, setPage] = useState(1);
  const [activeStatus, setActiveStatus] = useState<string | undefined>(undefined);

  const { data, isLoading } = useClaims(page, activeStatus);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">{t('claims')}</h1>

      {/* Status Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {STATUS_TABS.map((s) => (
          <button
            key={s.label}
            onClick={() => { setActiveStatus(s.key); setPage(1); }}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeStatus === s.key
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-500">{t('loading')}</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('claimNumber')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('workshop')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('vehicle')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('policyNumber')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('workshopEstimate')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('approvedAmount')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((claim: Record<string, unknown>) => (
                    <tr key={claim.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/claims/${claim.id as string}`}>
                          {(claim.claim_number as string) ?? `CLM-${(claim.id as string).slice(0, 6)}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(claim.workshop as Record<string, string> | undefined)?.name ??
                         (claim.tenant as Record<string, string> | undefined)?.name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(claim.vehicles as Record<string, string> | undefined)?.plate ??
                         (claim.vehicle as Record<string, string> | undefined)?.plate ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{(claim.policy_number as string) ?? '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[claim.status as string] ?? 'bg-gray-100 text-gray-600'}`}>
                          {(claim.status as string).replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                        {claim.workshop_estimate != null ? formatCurrency(claim.workshop_estimate as number) : '-'}
                      </td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                        {claim.approved_amount != null ? formatCurrency(claim.approved_amount as number) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {claim.created_at ? new Date(claim.created_at as string).toLocaleDateString() : '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                      {t('noClaims')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data?.meta && (data.meta.totalPages ?? 0) > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                {t('previous')}
              </button>
              <span className="text-sm text-gray-600">
                {page} / {data.meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data.meta.totalPages ?? 1)}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                {t('next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
