'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useAssessments, type AssessmentStatus } from '@/hooks/use-aida';
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
  const [status, setStatus] = useState<AssessmentStatus | 'all'>('all');

  const { data, isLoading } = useAssessments({
    status: status === 'all' ? undefined : status,
  });

  const rows = data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Damage assessments</h1>
          <p className="mt-1 text-sm text-gray-600">
            Capture-driven inspections. AIDA model output drops in here once trained — manual entry today.
          </p>
        </div>
      </div>

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
