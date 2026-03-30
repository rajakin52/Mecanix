'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@/i18n/navigation';
import { SkeletonTable } from '@mecanix/ui-web';

interface Estimate {
  id: string;
  estimate_number: string;
  version: number;
  status: string;
  grand_total: number;
  job_card_id: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  superseded: 'bg-gray-100 text-gray-400',
};

export default function EstimatesPage() {
  const tc = useTranslations('common');
  const qc = useQueryClient();

  // Fetch all estimates (we'll get them from the API — need a list-all endpoint)
  // For now, show estimates from all jobs
  const { data, isLoading } = useQuery({
    queryKey: ['all-estimates'],
    queryFn: async () => {
      // Get all jobs first, then their estimates
      const jobs = await api.get<{ data: Array<{ id: string }> }>('/jobs?pageSize=100');
      const jobList = Array.isArray(jobs) ? jobs : (jobs as { data: Array<{ id: string }> }).data ?? [];
      const allEstimates: Estimate[] = [];
      for (const job of jobList.slice(0, 50)) {
        try {
          const ests = await api.get<Estimate[]>(`/jobs/${job.id}/estimates`);
          if (Array.isArray(ests)) allEstimates.push(...ests);
        } catch { /* skip */ }
      }
      return allEstimates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const estimates = data ?? [];

  const [showCreate, setShowCreate] = useState(false);
  const [newDesc, setNewDesc] = useState('');
  const [newTotal, setNewTotal] = useState('');

  if (isLoading) return <SkeletonTable rows={6} cols={6} />;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Estimates</h1>
        <p className="text-sm text-gray-500">Estimates are created from job cards or standalone</p>
      </div>

      {/* Estimates table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Number</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Version</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Status</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Total</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {estimates.length > 0 ? estimates.map((est) => (
              <tr key={est.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{est.estimate_number}</td>
                <td className="px-4 py-3 text-sm text-gray-500">v{est.version}</td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[est.status] ?? 'bg-gray-100'}`}>
                    {est.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">{Number(est.grand_total).toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(est.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-end">
                  <a href={`/print/estimate/${est.id}`} target="_blank" className="text-xs text-primary-600 hover:text-primary-700">
                    Print
                  </a>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                  No estimates yet. Create estimates from the job card detail page.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
