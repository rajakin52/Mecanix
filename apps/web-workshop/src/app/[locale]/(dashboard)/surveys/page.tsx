'use client';

import { useState } from 'react';
import { useSurveySummary } from '@/hooks/use-surveys';
import { formatDate } from '@/lib/format';
import { SkeletonTable } from '@mecanix/ui-web';

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const RANGES: { label: string; days: number }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '12 months', days: 365 },
];

export default function SurveysPage() {
  const [days, setDays] = useState(30);
  const start = daysAgoISO(days);
  const end = new Date().toISOString().slice(0, 10);

  const { data, isLoading, isError, error } = useSurveySummary(start, end);

  const nps = data?.nps;
  const avg = data?.averageRating;
  const count = data?.responseCount ?? 0;
  const promoters = data?.promoters ?? 0;
  const passives = data?.passives ?? 0;
  const detractors = data?.detractors ?? 0;
  const recent = (data?.recentResponses ?? []) as Array<Record<string, unknown>>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Customer feedback</h1>
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setDays(r.days)}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                days === r.days ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Failed to load: {error instanceof Error ? error.message : 'unknown error'}
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Kpi label="NPS" value={nps != null ? nps.toFixed(0) : '—'} hint={`${count} response${count === 1 ? '' : 's'}`} />
            <Kpi label="Avg rating" value={avg != null ? avg.toFixed(1) : '—'} hint="out of 5" />
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs uppercase text-gray-500">Breakdown</div>
              <div className="mt-2 space-y-1.5 text-sm">
                <Row color="bg-green-500" label="Promoters" value={promoters} total={count} />
                <Row color="bg-gray-400" label="Passives" value={passives} total={count} />
                <Row color="bg-red-500" label="Detractors" value={detractors} total={count} />
              </div>
            </div>
            <Kpi label="Response count" value={String(count)} hint={`${days}-day window`} />
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Job / Customer</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Rating</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">NPS</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Comment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                      No responses in this window
                    </td>
                  </tr>
                ) : (
                  recent.map((r) => (
                    <tr key={r.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(r.created_at as string)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="font-medium text-gray-900">{(r.customer_name as string) ?? '-'}</div>
                        <div className="text-xs text-gray-500">{(r.job_number as string) ?? ''}</div>
                      </td>
                      <td className="px-4 py-3 text-end text-sm text-gray-900">{(r.rating as number) ?? '-'}</td>
                      <td className="px-4 py-3 text-end text-sm text-gray-700">{(r.nps_score as number) ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{(r.comment as string) ?? ''}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function Row({ color, label, value, total }: { color: string; label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <span className="flex-1 text-gray-700">{label}</span>
      <span className="text-gray-900">{value}</span>
      <span className="w-10 text-end text-xs text-gray-500">{pct}%</span>
    </div>
  );
}
