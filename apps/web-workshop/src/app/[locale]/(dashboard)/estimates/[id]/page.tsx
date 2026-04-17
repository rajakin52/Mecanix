'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useEstimate, useSendEstimate, useApproveEstimate, useRejectEstimate, useConvertEstimateToJob } from '@/hooks/use-estimates';
import { SkeletonPage, StatusBadge } from '@mecanix/ui-web';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tc = useTranslations('common');
  const router = useRouter();

  const { data: estimate, isLoading } = useEstimate(id);
  const sendMutation = useSendEstimate();
  const approveMutation = useApproveEstimate();
  const rejectMutation = useRejectEstimate();
  const convertMutation = useConvertEstimateToJob();

  // Fetch customer/vehicle for display
  const customerId = (estimate as Record<string, unknown> | undefined)?.customer_id as string | null;
  const vehicleId = (estimate as Record<string, unknown> | undefined)?.vehicle_id as string | null;

  const { data: customer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => api.get<{ full_name: string; phone: string; email?: string }>(`/customers/${customerId}`),
    enabled: !!customerId,
  });

  const { data: vehicle } = useQuery({
    queryKey: ['vehicle', vehicleId],
    queryFn: () => api.get<{ plate: string; make: string; model: string; year?: number }>(`/vehicles/${vehicleId}`),
    enabled: !!vehicleId,
  });

  const [converting, setConverting] = useState(false);

  if (isLoading) return <SkeletonPage />;
  if (!estimate) return <p className="text-gray-500">Estimate not found</p>;

  const est = estimate as unknown as Record<string, unknown>;
  const status = String(est.status ?? '');
  const source = String(est.source ?? 'job_card');
  const labourSnap = (est.labour_lines_snapshot ?? []) as Array<Record<string, unknown>>;
  const partsSnap = (est.parts_lines_snapshot ?? []) as Array<Record<string, unknown>>;
  const isStandalone = source === 'standalone';
  const convertedJobId = est.converted_job_card_id as string | null;
  const isConverted = !!convertedJobId;
  const jobCardId = est.job_card_id as string | null;

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const handleConvert = async () => {
    setConverting(true);
    try {
      const result = await convertMutation.mutateAsync({ id });
      router.push(`/jobs/${result.jobCard.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to convert');
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/estimates" className="text-sm text-gray-500 hover:text-gray-700">&larr; All Estimates</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            {est.estimate_number as string}
            <span className="ms-2 text-sm text-gray-400">v{est.version as number}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isStandalone ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {isStandalone ? 'Standalone' : 'Job Card'}
          </span>
        </div>
      </div>

      {/* Customer & Vehicle */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold text-gray-400 uppercase">Customer</p>
          <p className="font-semibold text-gray-900">{customer?.full_name ?? '-'}</p>
          <p className="text-sm text-gray-500">{customer?.phone ?? ''}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold text-gray-400 uppercase">Vehicle</p>
          <p className="font-mono font-bold text-gray-900">{vehicle?.plate ?? '-'}</p>
          <p className="text-sm text-gray-500">{vehicle ? `${vehicle.make} ${vehicle.model}` : ''}</p>
        </div>
      </div>

      {/* Reported Problem */}
      {est.reported_problem ? (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-bold text-gray-400 uppercase">Reported Problem</p>
          <p className="text-gray-900 mt-1">{String(est.reported_problem)}</p>
        </div>
      ) : null}

      {/* Labour Lines */}
      {labourSnap.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Labour ({labourSnap.length})</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                <th className="text-start py-2">Description</th>
                <th className="text-end py-2 w-20">Hours</th>
                <th className="text-end py-2 w-24">Rate</th>
                <th className="text-end py-2 w-28">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {labourSnap.map((l, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-900">{l.description as string}</td>
                  <td className="py-2 text-end text-gray-500">{Number(l.hours).toFixed(1)}</td>
                  <td className="py-2 text-end text-gray-500">{Number(l.rate).toFixed(2)}</td>
                  <td className="py-2 text-end font-medium text-gray-900">{Number(l.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-end mt-2 text-sm font-semibold text-gray-700">
            Labour Total: {Number(est.labour_total).toFixed(2)}
          </div>
        </div>
      )}

      {/* Parts Lines */}
      {partsSnap.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Parts ({partsSnap.length})</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                <th className="text-start py-2">Part</th>
                <th className="text-end py-2 w-16">Qty</th>
                <th className="text-end py-2 w-24">Price</th>
                <th className="text-end py-2 w-28">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {partsSnap.map((p, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 text-gray-900">
                    {p.part_name as string}
                    {p.part_number ? <span className="ms-2 text-xs text-gray-400 font-mono">{String(p.part_number)}</span> : null}
                  </td>
                  <td className="py-2 text-end text-gray-500">{Number(p.quantity)}</td>
                  <td className="py-2 text-end text-gray-500">{Number(p.sell_price ?? p.unit_cost).toFixed(2)}</td>
                  <td className="py-2 text-end font-medium text-gray-900">{Number(p.subtotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-end mt-2 text-sm font-semibold text-gray-700">
            Parts Total: {Number(est.parts_total).toFixed(2)}
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-end">
        <div className="text-sm text-gray-500">Subtotal: {round2(Number(est.labour_total) + Number(est.parts_total)).toFixed(2)}</div>
        <div className="text-sm text-gray-500">Tax ({Number(est.tax_rate)}%): {Number(est.tax_amount).toFixed(2)}</div>
        <div className="text-2xl font-bold text-gray-900 mt-1">{Number(est.grand_total).toFixed(2)}</div>
      </div>

      {/* Actions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Actions</h3>
        <div className="flex flex-wrap gap-3">
          {/* Print */}
          <a href={`/print/estimate/${id}`} target="_blank"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Print
          </a>

          {/* Send */}
          {(status === 'draft') && (
            <button
              onClick={() => sendMutation.mutate({ id, channels: ['whatsapp', 'push'] })}
              disabled={sendMutation.isPending}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
              {sendMutation.isPending ? 'Sending...' : 'Send to Customer'}
            </button>
          )}

          {/* Approve / Reject */}
          {(status === 'sent' || status === 'draft') ? (
            <>
              <button
                onClick={() => approveMutation.mutate({ id, method: 'manual' })}
                disabled={approveMutation.isPending}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                Approve
              </button>
              <button
                onClick={() => rejectMutation.mutate({ id })}
                disabled={rejectMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                Reject
              </button>
            </>
          ) : null}

          {/* Convert to Job Card */}
          {isStandalone && ['approved', 'draft', 'sent'].includes(status) && !isConverted ? (
            <button
              onClick={handleConvert}
              disabled={converting}
              className="rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-50 shadow-md">
              {converting ? 'Converting...' : 'Convert to Job Card'}
            </button>
          ) : null}

          {/* Link to job card */}
          {isConverted ? (
            <Link href={`/jobs/${convertedJobId}`}
              className="rounded-lg bg-green-100 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-200">
              View Job Card &rarr;
            </Link>
          ) : null}
          {jobCardId && !isConverted ? (
            <Link href={`/jobs/${jobCardId}`}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200">
              View Job Card &rarr;
            </Link>
          ) : null}
        </div>
      </div>

      {/* Metadata */}
      <div className="text-xs text-gray-400 space-y-1">
        {est.sent_at ? <p>Sent: {new Date(String(est.sent_at)).toLocaleString()}</p> : null}
        {est.approved_at ? <p>Approved: {new Date(String(est.approved_at)).toLocaleString()} ({String(est.approval_method)})</p> : null}
        {est.rejected_at ? <p>Rejected: {new Date(String(est.rejected_at)).toLocaleString()}</p> : null}
        {est.valid_until ? <p>Valid until: {new Date(String(est.valid_until)).toLocaleDateString()}</p> : null}
        <p>Created: {new Date(est.created_at as string).toLocaleString()}</p>
      </div>
    </div>
  );
}
