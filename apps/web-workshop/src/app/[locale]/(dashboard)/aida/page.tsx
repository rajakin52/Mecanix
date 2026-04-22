'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAssessments, useAidaStats, type AssessmentStatus } from '@/hooks/use-aida';
import { formatCurrency, formatDate } from '@/lib/format';
import { SkeletonTable, EmptyState } from '@mecanix/ui-web';

const STATUSES: Array<{ v: AssessmentStatus | 'all'; label: string }> = [
  { v: 'all', label: 'All' },
  { v: 'capturing', label: 'Capturing' },
  { v: 'analysing', label: 'Analysing' },
  { v: 'ready', label: 'Ready' },
  { v: 'approved', label: 'Approved' },
  { v: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE: Record<AssessmentStatus, string> = {
  capturing: 'bg-blue-100 text-blue-700',
  analysing: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-purple-100 text-purple-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

export default function AidaListPage() {
  const t = useTranslations('aida');
  const [status, setStatus] = useState<AssessmentStatus | 'all'>('all');

  const { data, isLoading } = useAssessments({
    status: status === 'all' ? undefined : status,
  });
  const { data: stats } = useAidaStats();

  const rows = data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('pageTitle')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('pageSubtitle')}</p>
        </div>
      </div>

      {stats && (
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {(() => {
            const pctUsed =
              stats.monthlyAnalysesMax > 0
                ? (stats.analysesThisMonth / stats.monthlyAnalysesMax) * 100
                : 0;
            const capColor =
              pctUsed >= 90
                ? 'text-red-600'
                : pctUsed >= 70
                  ? 'text-amber-600'
                  : 'text-gray-900';
            return (
              <>
                <div className="rounded-lg bg-white p-4 shadow ring-1 ring-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    {t('statsThisMonth')}
                  </div>
                  <div className={`mt-1 text-2xl font-semibold tabular-nums ${capColor}`}>
                    {stats.analysesThisMonth}
                    <span className="ms-1 text-sm text-gray-400">
                      / {stats.monthlyAnalysesMax}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pctUsed >= 90
                          ? 'bg-red-500'
                          : pctUsed >= 70
                            ? 'bg-amber-500'
                            : 'bg-purple-500'
                      }`}
                      style={{ width: `${Math.min(100, pctUsed)}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-lg bg-white p-4 shadow ring-1 ring-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    {t('statsTotalAnalyses')}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                    {stats.totalAnalyses}
                  </div>
                </div>
                <div className="rounded-lg bg-white p-4 shadow ring-1 ring-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    {t('statsAvgConfidence')}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                    {stats.avgConfidence != null
                      ? `${Math.round(stats.avgConfidence * 100)}%`
                      : '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-white p-4 shadow ring-1 ring-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-500">
                    {t('statsEditRate')}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                    {stats.editRate != null ? `${Math.round(stats.editRate * 100)}%` : '—'}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.v}
            type="button"
            onClick={() => setStatus(s.v)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              status === s.v
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No assessments yet"
          description="Start an assessment from a job card or vehicle page."
        />
      ) : (
        <div className="overflow-hidden rounded-lg bg-white shadow ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Vehicle</th>
                <th className="px-4 py-3">Job / Claim</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Hours</th>
                <th className="px-4 py-3 text-right">Estimate</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.vehicle?.plate ?? '—'}</div>
                    <div className="text-xs text-gray-500">
                      {r.vehicle ? `${r.vehicle.make} ${r.vehicle.model}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.job_card?.job_number ?? r.claim?.claim_number ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.source}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{Number(r.total_hours || 0).toFixed(1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(Number(r.total_estimate || 0))}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/aida/${r.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
