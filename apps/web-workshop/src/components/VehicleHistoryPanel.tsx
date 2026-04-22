'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatCurrency, formatDate } from '@/lib/format';
import type { VehicleHistory } from '@/hooks/use-vehicles';

interface Props {
  history: VehicleHistory | undefined;
  loading?: boolean;
  /** When true, render a compact view (last 5 jobs, top 5 parts). */
  compact?: boolean;
}

export function VehicleHistoryPanel({ history, loading, compact }: Props) {
  const t = useTranslations('vehicleHistory');

  if (loading) {
    return <div className="text-sm text-gray-500">{t('loading')}</div>;
  }
  if (!history || history.cost_summary.job_count === 0) {
    return <div className="text-sm text-gray-500">{t('empty')}</div>;
  }

  const cs = history.cost_summary;
  const jobs = compact ? history.jobs.slice(0, 5) : history.jobs;
  const parts = compact ? history.parts_history.slice(0, 5) : history.parts_history;
  const assessments = compact ? history.assessments.slice(0, 3) : history.assessments;
  const categoryEntries = Object.entries(cs.by_category).filter(([, v]) => v.count > 0);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile label={t('totalSpent')} value={formatCurrency(cs.total_spent)} />
        <KpiTile label={t('jobCount')} value={String(cs.job_count)} />
        <KpiTile label={t('labourTotal')} value={formatCurrency(cs.labour_total)} />
        <KpiTile label={t('partsTotal')} value={formatCurrency(cs.parts_total)} />
      </div>

      {/* Category breakdown (non-compact only) */}
      {!compact && categoryEntries.length > 0 && (
        <div className="rounded-lg bg-gray-50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            {t('byCategory')}
          </h3>
          <div className="flex flex-wrap gap-2">
            {categoryEntries.map(([cat, v]) => (
              <span
                key={cat}
                className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs ring-1 ring-gray-200"
              >
                <span className="font-medium text-gray-700">
                  {t(`category_${cat}` as 'category_mechanical')}
                </span>
                <span className="text-gray-500">· {v.count}</span>
                <span className="tabular-nums text-gray-900">{formatCurrency(v.total)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Jobs list */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          {compact ? t('recentJobs') : t('allJobs')}
        </h3>
        <div className="divide-y divide-gray-100 rounded-lg ring-1 ring-gray-200 bg-white">
          {jobs.map((j) => (
            <div key={j.id} className="flex items-start justify-between gap-4 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/jobs/${j.id}`}
                    className="text-sm font-medium text-primary-600 hover:underline"
                  >
                    {j.job_number}
                  </Link>
                  <span className="text-xs text-gray-400">{formatDate(j.created_at)}</span>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                    {j.status}
                  </span>
                  {j.job_type === 'body_repair' && (
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[9px] font-bold text-red-700 ring-1 ring-inset ring-red-200"
                      title="Body Repair"
                    >
                      B
                    </span>
                  )}
                </div>
                {j.reported_problem && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{j.reported_problem}</p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold tabular-nums text-gray-900">
                  {formatCurrency(j.grand_total)}
                </div>
                {j.primary_technician && (
                  <div className="text-xs text-gray-400">{j.primary_technician.full_name}</div>
                )}
              </div>
            </div>
          ))}
          {history.jobs.length > jobs.length && (
            <div className="px-4 py-2 text-center text-xs text-gray-500">
              {t('moreJobs', { count: history.jobs.length - jobs.length })}
            </div>
          )}
        </div>
      </div>

      {/* AIDA assessments */}
      {assessments.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            {compact ? t('recentAssessments') : t('allAssessments')}
          </h3>
          <div className="divide-y divide-gray-100 rounded-lg ring-1 ring-gray-200 bg-white">
            {assessments.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/aida/${a.id}`}
                      className="text-sm font-medium text-purple-600 hover:underline"
                    >
                      {formatDate(a.created_at)}
                    </Link>
                    <span className="inline-flex items-center rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                      {a.status}
                    </span>
                    {a.source !== 'manual' && (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                        AI
                      </span>
                    )}
                    {a.job_card && (
                      <Link
                        href={`/jobs/${a.job_card_id}`}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        → {a.job_card.job_number}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold tabular-nums text-gray-900">
                    {formatCurrency(a.total_estimate)}
                  </div>
                  {a.confidence_avg != null && (
                    <div className="text-xs text-gray-400">
                      {Math.round(a.confidence_avg * 100)}% {t('confidenceShort')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parts-installed history */}
      {parts.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            {compact ? t('topParts') : t('allParts')}
          </h3>
          <div className="divide-y divide-gray-100 rounded-lg ring-1 ring-gray-200 bg-white">
            {parts.map((p) => (
              <div
                key={p.part_number ?? p.part_name}
                className="flex items-center justify-between gap-4 px-4 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900">{p.part_name}</div>
                  {p.part_number && (
                    <div className="text-xs text-gray-400 font-mono">{p.part_number}</div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-gray-500">
                    {t('lastInstalled', { date: formatDate(p.last_installed) })}
                  </div>
                  <div className="text-xs text-gray-400">
                    {t('installCount', { count: p.install_count })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-gray-200">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-gray-900">{value}</div>
    </div>
  );
}
