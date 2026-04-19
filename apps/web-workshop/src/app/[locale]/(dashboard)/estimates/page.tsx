'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import { useAllEstimates, useConvertEstimateToJob, type Estimate } from '@/hooks/use-estimates';
import { SkeletonTable, StatusBadge, EmptyState } from '@mecanix/ui-web';
import { formatNumber } from '@/lib/format';

const STATUS_KEYS = [
  { key: undefined, tKey: 'all' },
  { key: 'draft', tKey: 'draft' },
  { key: 'sent', tKey: 'sent' },
  { key: 'approved', tKey: 'approved' },
  { key: 'rejected', tKey: 'rejected' },
  { key: 'superseded', tKey: 'superseded' },
] as const;

const SOURCE_KEYS = [
  { key: undefined, tKey: 'all' },
  { key: 'standalone', tKey: 'standalone' },
  { key: 'job_card', tKey: 'job_card' },
] as const;

export default function EstimatesPage() {
  const tc = useTranslations('common');
  const tStatus = useTranslations('estimates.statuses');
  const tSource = useTranslations('estimates.sources');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [activeStatus, setActiveStatus] = useState<string | undefined>(undefined);
  const [activeSource, setActiveSource] = useState<string | undefined>(undefined);

  const { data, isLoading, isError, error: queryError } = useAllEstimates(page, debouncedSearch, activeStatus, activeSource);
  const convertMutation = useConvertEstimateToJob();

  const formatCurrency = (val: number) => formatNumber(val, undefined, 2);

  const handleConvert = async (est: Estimate) => {
    if (!confirm(`Convert estimate ${est.estimate_number} to a job card?`)) return;
    try {
      const result = await convertMutation.mutateAsync({ id: est.id });
      window.location.href = `/jobs/${result.jobCard.id}`;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to convert');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Estimates</h1>
        <Link href="/estimates/new"
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          New Estimate
        </Link>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {STATUS_KEYS.map((s) => (
          <button
            key={s.tKey}
            onClick={() => { setActiveStatus(s.key); setPage(1); }}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeStatus === s.key
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tStatus(s.tKey)}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="mb-4 flex gap-3">
        <input
          type="text"
          placeholder="Search by estimate number..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={activeSource ?? ''}
          onChange={(e) => { setActiveSource(e.target.value || undefined); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm"
        >
          {SOURCE_KEYS.map((s) => (
            <option key={s.tKey} value={s.key ?? ''}>{tSource(s.tKey)}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={8} />
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Failed to load estimates: {queryError instanceof Error ? queryError.message : 'unknown error'}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Number</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Vehicle</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Source</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Total</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(data?.data ?? []).length > 0 ? (data?.data ?? []).map((est) => (
                  <tr key={est.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono font-semibold text-primary-600">
                      <Link href={`/estimates/${est.id}`}>{est.estimate_number}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {est.customers?.full_name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {est.vehicles ? (
                        <span>
                          <span className="font-mono font-semibold text-gray-900">{est.vehicles.plate}</span>
                          <span className="ms-1 text-xs text-gray-400">{est.vehicles.make} {est.vehicles.model}</span>
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        est.source === 'standalone'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {est.source === 'standalone' ? 'Standalone' : 'Job Card'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={est.status} />
                    </td>
                    <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                      {formatCurrency(Number(est.grand_total))}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(est.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-end text-sm space-x-2">
                      <a href={`/print/estimate/${est.id}`} target="_blank" className="text-xs text-primary-600 hover:text-primary-700">
                        Print
                      </a>
                      {est.source === 'standalone' && est.status === 'approved' && !est.converted_job_card_id && (
                        <button
                          onClick={() => handleConvert(est)}
                          disabled={convertMutation.isPending}
                          className="text-xs font-semibold text-green-600 hover:text-green-700"
                        >
                          Convert to Job
                        </button>
                      )}
                      {est.converted_job_card_id && (
                        <Link href={`/jobs/${est.converted_job_card_id}`} className="text-xs text-green-600 hover:text-green-700">
                          View Job
                        </Link>
                      )}
                      {est.job_card_id && !est.converted_job_card_id && (
                        <Link href={`/jobs/${est.job_card_id}`} className="text-xs text-gray-500 hover:text-gray-700">
                          Job
                        </Link>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon="estimates" title="No estimates yet" description="Create a standalone estimate or generate one from a job card" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                {tc('previous')}
              </button>
              <span className="text-sm text-gray-600">
                {page} / {data.meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                {tc('next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
