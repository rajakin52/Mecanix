'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useClaim, useApproveEstimate, useRejectEstimate, useReviewEstimateLine } from '@/hooks/use-insurance-portal';
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

export default function ClaimDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('portal');

  const { data: claim, isLoading } = useClaim(id);
  const approveMutation = useApproveEstimate();
  const rejectMutation = useRejectEstimate();
  const reviewLineMutation = useReviewEstimateLine();

  // Approve / Reject modal
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [assessorName, setAssessorName] = useState('');
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  // Line review modal
  const [showLineModal, setShowLineModal] = useState(false);
  const [reviewLineId, setReviewLineId] = useState('');
  const [lineStatus, setLineStatus] = useState('approved');
  const [linePrice, setLinePrice] = useState('');
  const [lineNotes, setLineNotes] = useState('');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const handleApprove = async (estimateId: string) => {
    if (!assessorName) return;
    await approveMutation.mutateAsync({ id: estimateId, assessorName, notes: approveNotes || undefined });
    setShowApproveModal(false);
    setAssessorName('');
    setApproveNotes('');
  };

  const handleReject = async (estimateId: string) => {
    if (!assessorName || !rejectReason) return;
    await rejectMutation.mutateAsync({ id: estimateId, assessorName, reason: rejectReason });
    setShowRejectModal(false);
    setAssessorName('');
    setRejectReason('');
  };

  const handleReviewLine = async () => {
    if (!reviewLineId) return;
    await reviewLineMutation.mutateAsync({
      lineId: reviewLineId,
      status: lineStatus,
      assessorPrice: linePrice ? Number(linePrice) : undefined,
      notes: lineNotes || undefined,
    });
    setShowLineModal(false);
    setReviewLineId('');
    setLineStatus('approved');
    setLinePrice('');
    setLineNotes('');
  };

  const openLineReview = (lineId: string, currentPrice: number) => {
    setReviewLineId(lineId);
    setLinePrice(String(currentPrice));
    setLineStatus('approved');
    setLineNotes('');
    setShowLineModal(true);
  };

  if (isLoading) {
    return <p className="text-gray-500">{t('loading')}</p>;
  }

  if (!claim) {
    return <p className="text-gray-500">{t('noClaims')}</p>;
  }

  const c = claim as Record<string, unknown>;
  const status = c.status as string;
  const estimates = (c.estimates as Array<Record<string, unknown>>) ?? [];
  const latestEstimate = estimates.length > 0 ? estimates[estimates.length - 1] : null;
  const photos = (c.photos as Array<Record<string, unknown>>) ?? [];

  const damagePhotos = photos.filter((p) => (p.stage as string) === 'damage');
  const repairPhotos = photos.filter((p) => (p.stage as string) === 'repair');
  const completionPhotos = photos.filter((p) => (p.stage as string) === 'completion');

  const labourLines = (latestEstimate?.labour_lines as Array<Record<string, unknown>>) ?? [];
  const partsLines = (latestEstimate?.parts_lines as Array<Record<string, unknown>>) ?? [];

  const canReview = status === 'submitted' || status === 'under_review';

  return (
    <div>
      {/* Back link */}
      <div className="mb-4">
        <Link href="/claims" className="text-sm text-primary-600 hover:underline">
          &larr; {t('back')}
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
        {canReview && latestEstimate && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowRejectModal(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              {t('reject')}
            </button>
            <button
              onClick={() => setShowApproveModal(true)}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              {t('approve')}
            </button>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('workshop')}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {(c.workshop as Record<string, string> | undefined)?.name ??
             (c.tenant as Record<string, string> | undefined)?.name ?? '-'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('vehicle')}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {(c.vehicles as Record<string, string> | undefined)?.plate ??
             (c.vehicle as Record<string, string> | undefined)?.plate ?? '-'}
            {' '}
            {(c.vehicles as Record<string, string> | undefined)?.make ?? ''}
            {' '}
            {(c.vehicles as Record<string, string> | undefined)?.model ?? ''}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('customer')}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {(c.customers as Record<string, string> | undefined)?.full_name ??
             (c.customer as Record<string, string> | undefined)?.full_name ?? '-'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('policyNumber')}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{(c.policy_number as string) ?? '-'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('excess')}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {c.excess_amount != null ? formatCurrency(c.excess_amount as number) : '-'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('date')}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {c.created_at ? new Date(c.created_at as string).toLocaleDateString() : '-'}
          </p>
        </div>
      </div>

      {/* Estimate Review Section */}
      {latestEstimate ? (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('estimateReview')}</h2>

          {/* Labour Lines */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('labourLines')}</h3>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('description')}</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('qty')}</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('price')}</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('subtotal')}</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('assessorStatus')}</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('assessorPrice')}</th>
                    {canReview && (
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('action')}</th>
                    )}
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
                        {canReview && (
                          <td className="px-4 py-2 text-end">
                            <button
                              onClick={() => openLineReview(line.id as string, (line.subtotal ?? 0) as number)}
                              className="text-sm font-medium text-primary-600 hover:text-primary-700"
                            >
                              {t('review')}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={canReview ? 7 : 6} className="px-4 py-4 text-center text-sm text-gray-400">-</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Parts Lines */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('partsLines')}</h3>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('description')}</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('qty')}</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('price')}</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('subtotal')}</th>
                    <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('assessorStatus')}</th>
                    <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('assessorPrice')}</th>
                    {canReview && (
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('action')}</th>
                    )}
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
                        {canReview && (
                          <td className="px-4 py-2 text-end">
                            <button
                              onClick={() => openLineReview(line.id as string, (line.subtotal ?? 0) as number)}
                              className="text-sm font-medium text-primary-600 hover:text-primary-700"
                            >
                              {t('review')}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={canReview ? 7 : 6} className="px-4 py-4 text-center text-sm text-gray-400">-</td>
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
        </div>
      ) : (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
          {t('noEstimate')}
        </div>
      )}

      {/* Photos Section */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('photos')}</h2>
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

      {/* Approve Modal */}
      {showApproveModal && latestEstimate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('approveEstimate')}</h2>
              <button onClick={() => setShowApproveModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('assessorName')}</label>
                <input
                  type="text"
                  value={assessorName}
                  onChange={(e) => setAssessorName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('notes')}</label>
                <textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowApproveModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleApprove(latestEstimate.id as string)}
                  disabled={approveMutation.isPending || !assessorName}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {approveMutation.isPending ? t('loading') : t('approve')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && latestEstimate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('rejectEstimate')}</h2>
              <button onClick={() => setShowRejectModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('assessorName')}</label>
                <input
                  type="text"
                  value={assessorName}
                  onChange={(e) => setAssessorName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('reason')}</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowRejectModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleReject(latestEstimate.id as string)}
                  disabled={rejectMutation.isPending || !assessorName || !rejectReason}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectMutation.isPending ? t('loading') : t('reject')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Line Review Modal */}
      {showLineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('reviewLine')}</h2>
              <button onClick={() => setShowLineModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('assessorStatus')}</label>
                <select
                  value={lineStatus}
                  onChange={(e) => setLineStatus(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="approved">{t('approve')}</option>
                  <option value="reduced">{t('reduced')}</option>
                  <option value="rejected">{t('reject')}</option>
                </select>
              </div>
              {lineStatus !== 'rejected' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('assessorPrice')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={linePrice}
                    onChange={(e) => setLinePrice(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('notes')}</label>
                <textarea
                  value={lineNotes}
                  onChange={(e) => setLineNotes(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowLineModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {t('cancel')}
                </button>
                <button
                  onClick={handleReviewLine}
                  disabled={reviewLineMutation.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {reviewLineMutation.isPending ? t('loading') : t('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
