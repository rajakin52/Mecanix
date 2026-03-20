'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useClaim, useChangeClaimStatus, useCreateEstimate, useApproveEstimate } from '@/hooks/use-insurance';
import { Link } from '@/i18n/navigation';

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

const ASSESSOR_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  approved: 'bg-green-100 text-green-700',
  reduced: 'bg-yellow-100 text-yellow-700',
  rejected: 'bg-red-100 text-red-700',
};

// Valid next statuses per current status
const NEXT_STATUSES: Record<string, string[]> = {
  initiated: ['documented'],
  documented: ['submitted'],
  submitted: ['under_review'],
  under_review: ['approved', 'partially_approved', 'rejected'],
  approved: ['in_repair'],
  partially_approved: ['in_repair'],
  rejected: [],
  in_repair: ['completed'],
  completed: ['paid'],
  paid: [],
};

export default function ClaimDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('insurance');
  const tc = useTranslations('common');
  const locale = useLocale();

  const { data: claim, isLoading } = useClaim(id);
  const changeStatusMutation = useChangeClaimStatus();
  const createEstimateMutation = useCreateEstimate();
  const approveEstimateMutation = useApproveEstimate();

  // Status change
  const [statusNotes, setStatusNotes] = useState('');

  // Approve estimate modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [assessorName, setAssessorName] = useState('');
  const [approveNotes, setApproveNotes] = useState('');

  // Add photo modal
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoStage, setPhotoStage] = useState('damage');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(locale, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const handleStatusChange = async (newStatus: string) => {
    await changeStatusMutation.mutateAsync({ id, status: newStatus, notes: statusNotes || undefined });
    setStatusNotes('');
  };

  const handleCreateEstimate = async () => {
    await createEstimateMutation.mutateAsync(id);
  };

  const handleApproveEstimate = async (estimateId: string) => {
    if (!assessorName) return;
    await approveEstimateMutation.mutateAsync({ id: estimateId, assessorName, notes: approveNotes || undefined });
    setShowApproveModal(false);
    setAssessorName('');
    setApproveNotes('');
  };

  if (isLoading) {
    return <p className="text-gray-500">{tc('loading')}</p>;
  }

  if (!claim) {
    return <p className="text-gray-500">{t('noClaims')}</p>;
  }

  const c = claim as Record<string, unknown>;
  const status = c.status as string;
  const nextStatuses = NEXT_STATUSES[status] ?? [];
  const estimates = (c.estimates as Array<Record<string, unknown>>) ?? [];
  const latestEstimate = estimates.length > 0 ? estimates[estimates.length - 1] : null;
  const photos = (c.photos as Array<Record<string, unknown>>) ?? [];
  const actions = (c.assessor_actions as Array<Record<string, unknown>>) ?? (c.timeline as Array<Record<string, unknown>>) ?? [];

  const damagePhotos = photos.filter((p) => (p.stage as string) === 'damage');
  const repairPhotos = photos.filter((p) => (p.stage as string) === 'repair');
  const completionPhotos = photos.filter((p) => (p.stage as string) === 'completion');

  const labourLines = (latestEstimate?.labour_lines as Array<Record<string, unknown>>) ?? [];
  const partsLines = (latestEstimate?.parts_lines as Array<Record<string, unknown>>) ?? [];

  return (
    <div>
      {/* Back link */}
      <div className="mb-4">
        <Link href="/insurance" className="text-sm text-primary-600 hover:underline">
          &larr; {tc('back')}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">
            {(c.claim_number as string) ?? `CLM-${id.slice(0, 6)}`}
          </h1>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex gap-2">
          {nextStatuses.map((ns) => (
            <button
              key={ns}
              onClick={() => handleStatusChange(ns)}
              disabled={changeStatusMutation.isPending}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${
                ns === 'rejected'
                  ? 'bg-red-600 hover:bg-red-700'
                  : ns === 'approved' || ns === 'completed' || ns === 'paid'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-primary-600 hover:bg-primary-700'
              }`}
            >
              {changeStatusMutation.isPending ? tc('loading') : ns.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Status change notes */}
      {nextStatuses.length > 0 && (
        <div className="mb-6">
          <input
            type="text"
            placeholder={tc('notes') + '...'}
            value={statusNotes}
            onChange={(e) => setStatusNotes(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      )}

      {/* Info Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Job #</p>
          <Link
            href={`/jobs/${(c.job_card_id ?? c.jobCardId) as string}`}
            className="mt-1 block text-sm font-medium text-primary-600 hover:underline"
          >
            {(c.job_cards as Record<string, string> | undefined)?.job_number ??
             (c.job_card as Record<string, string> | undefined)?.job_number ?? '-'}
          </Link>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Vehicle</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {(c.vehicles as Record<string, string> | undefined)?.plate ??
             (c.vehicle as Record<string, string> | undefined)?.plate ?? '-'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Customer</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {(c.customers as Record<string, string> | undefined)?.full_name ??
             (c.customer as Record<string, string> | undefined)?.full_name ?? '-'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('insurer')}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {(c.insurance_company as Record<string, string> | undefined)?.name ??
             (c.insurance_companies as Record<string, string> | undefined)?.name ?? '-'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('policyNumber')}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{(c.policy_number as string) ?? '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('excessAmount')}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {c.excess_amount != null ? formatCurrency(c.excess_amount as number) : '-'}
          </p>
        </div>
      </div>

      {/* Estimate Section */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('estimate')}</h2>
          <div className="flex gap-2">
            {!latestEstimate && (
              <button
                onClick={handleCreateEstimate}
                disabled={createEstimateMutation.isPending}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createEstimateMutation.isPending ? tc('loading') : t('createEstimate')}
              </button>
            )}
            {latestEstimate && (
              <button
                onClick={() => setShowApproveModal(true)}
                className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
              >
                {t('approve')}
              </button>
            )}
          </div>
        </div>

        {latestEstimate ? (
          <>
            {/* Labour Lines */}
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Labour</h3>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Description</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Qty</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Price</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Subtotal</th>
                      <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Assessor</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Assessor Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {labourLines.length > 0 ? (
                      labourLines.map((line, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-700">{line.description as string}</td>
                          <td className="px-4 py-2 text-end text-sm text-gray-700">{(line.quantity ?? line.hours ?? 1) as number}</td>
                          <td className="px-4 py-2 text-end text-sm text-gray-700">{formatCurrency((line.price ?? line.rate ?? 0) as number)}</td>
                          <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">{formatCurrency((line.subtotal ?? 0) as number)}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ASSESSOR_STATUS_COLORS[(line.assessor_status as string) ?? 'pending'] ?? 'bg-gray-100 text-gray-600'}`}>
                              {((line.assessor_status as string) ?? 'pending').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-end text-sm text-gray-700">
                            {line.assessor_price != null ? formatCurrency(line.assessor_price as number) : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-400">-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Parts Lines */}
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Parts</h3>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Description</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Qty</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Price</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Subtotal</th>
                      <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Assessor</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Assessor Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {partsLines.length > 0 ? (
                      partsLines.map((line, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-700">{(line.description ?? line.part_name) as string}</td>
                          <td className="px-4 py-2 text-end text-sm text-gray-700">{(line.quantity ?? 1) as number}</td>
                          <td className="px-4 py-2 text-end text-sm text-gray-700">{formatCurrency((line.price ?? line.sell_price ?? 0) as number)}</td>
                          <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">{formatCurrency((line.subtotal ?? 0) as number)}</td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ASSESSOR_STATUS_COLORS[(line.assessor_status as string) ?? 'pending'] ?? 'bg-gray-100 text-gray-600'}`}>
                              {((line.assessor_status as string) ?? 'pending').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-end text-sm text-gray-700">
                            {line.assessor_price != null ? formatCurrency(line.assessor_price as number) : '-'}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-4 text-center text-sm text-gray-400">-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Estimate Totals */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-700">{t('workshopEstimate')}</span>
                <span className="font-bold text-gray-900">
                  {latestEstimate.workshop_total != null ? formatCurrency(latestEstimate.workshop_total as number) : '-'}
                </span>
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="font-medium text-gray-700">{t('approvedAmount')}</span>
                <span className="font-bold text-green-700">
                  {latestEstimate.approved_total != null ? formatCurrency(latestEstimate.approved_total as number) : '-'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            {t('createEstimate')}
          </div>
        )}
      </div>

      {/* Photos Section */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('photos')}</h2>
          <button
            onClick={() => setShowPhotoModal(true)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {t('addPhoto')}
          </button>
        </div>

        {[
          { key: 'damage', label: t('damagePhotos'), items: damagePhotos },
          { key: 'repair', label: t('repairPhotos'), items: repairPhotos },
          { key: 'completion', label: t('completionPhotos'), items: completionPhotos },
        ].map((group) => (
          <div key={group.key} className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-600">{group.label}</h3>
            {group.items.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {group.items.map((photo, idx) => (
                  <div key={idx} className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                    <img
                      src={photo.url as string}
                      alt={`${group.key} photo ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">-</p>
            )}
          </div>
        ))}
      </div>

      {/* Assessor Actions Timeline */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('assessorActions')}</h2>
        {actions.length > 0 ? (
          <div className="space-y-3">
            {actions.map((action, idx) => (
              <div key={idx} className="flex gap-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex-shrink-0">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {(action.action ?? action.description ?? action.type) as string}
                  </p>
                  {action.notes && (
                    <p className="mt-1 text-sm text-gray-500">{action.notes as string}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">
                    {action.created_at ? new Date(action.created_at as string).toLocaleString(locale) : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">-</p>
        )}
      </div>

      {/* Approve Estimate Modal */}
      {showApproveModal && latestEstimate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('approve')} {t('estimate')}</h2>
              <button onClick={() => setShowApproveModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Assessor Name</label>
                <input
                  type="text"
                  value={assessorName}
                  onChange={(e) => setAssessorName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowApproveModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={() => handleApproveEstimate(latestEstimate.id as string)}
                  disabled={approveEstimateMutation.isPending || !assessorName}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {approveEstimateMutation.isPending ? tc('loading') : t('approve')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('addPhoto')}</h2>
              <button onClick={() => setShowPhotoModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Stage</label>
                <select
                  value={photoStage}
                  onChange={(e) => setPhotoStage(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="damage">{t('damagePhotos')}</option>
                  <option value="repair">{t('repairPhotos')}</option>
                  <option value="completion">{t('completionPhotos')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">URL</label>
                <input
                  type="url"
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowPhotoModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={() => {
                    // For now just close - will integrate with API when ready
                    setShowPhotoModal(false);
                    setPhotoUrl('');
                  }}
                  disabled={!photoUrl}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {tc('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
