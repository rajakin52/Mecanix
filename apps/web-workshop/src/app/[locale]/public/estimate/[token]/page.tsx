'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface EstimateData {
  estimate: {
    id: string;
    estimate_number: string;
    version: number;
    status: string;
    labour_total: number;
    parts_total: number;
    tax_rate: number;
    tax_amount: number;
    grand_total: number;
    labour_lines_snapshot: Array<Record<string, unknown>>;
    parts_lines_snapshot: Array<Record<string, unknown>>;
    dvi_snapshot: Array<Record<string, unknown>> | null;
    valid_until: string | null;
    is_revision: boolean;
    change_summary: string | null;
    created_at: string;
  };
  customer: { full_name: string; phone: string; email: string } | null;
  vehicle: { plate: string; make: string; model: string; year: number } | null;
  workshop: { name: string; phone: string; email: string; address: string; tax_id: string } | null;
}

export default function PublicEstimatePage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionDone, setActionDone] = useState<'approved' | 'rejected' | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/public/estimates/${token}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setData(json.data);
        else setError(json.error?.message ?? 'Invalid or expired link');
      })
      .catch(() => setError('Failed to load estimate'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/public/estimates/${token}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success || json.data?.approved) setActionDone('approved');
      else setError(json.error?.message ?? 'Failed to approve');
    } catch { setError('Network error'); }
    setSubmitting(false);
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/public/estimates/${token}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: rejectReason }),
      });
      const json = await res.json();
      if (json.success || json.data?.rejected) setActionDone('rejected');
      else setError(json.error?.message ?? 'Failed');
    } catch { setError('Network error'); }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading estimate...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-xl font-bold text-red-600 mb-2">Error</p>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (actionDone) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-sm mx-auto p-8">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${actionDone === 'approved' ? 'bg-green-100' : 'bg-red-100'}`}>
            <span className="text-3xl">{actionDone === 'approved' ? '\u2713' : '\u2717'}</span>
          </div>
          <h1 className={`text-2xl font-bold ${actionDone === 'approved' ? 'text-green-800' : 'text-red-800'}`}>
            {actionDone === 'approved' ? 'Estimate Approved' : 'Estimate Rejected'}
          </h1>
          <p className="mt-2 text-gray-600">
            {actionDone === 'approved'
              ? 'Thank you! The workshop has been notified and work will begin shortly.'
              : 'The workshop has been notified of your decision.'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { estimate, customer, vehicle, workshop } = data;
  const fmt = (n: number) => Number(n).toFixed(2);
  const isApprovable = estimate.status === 'sent' || estimate.status === 'draft';

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-xl">
        {/* Workshop header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black text-gray-900">{workshop?.name ?? 'MECANIX'}</h1>
          {workshop?.phone && <p className="text-sm text-gray-500">{workshop.phone}</p>}
        </div>

        {/* Estimate card */}
        <div className="rounded-xl bg-white shadow-lg overflow-hidden">
          {/* Header bar */}
          <div className="bg-primary-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80">Estimate</p>
                <p className="text-xl font-bold">{estimate.estimate_number}</p>
              </div>
              <div className="text-end">
                <p className="text-2xl font-black">{fmt(estimate.grand_total)} Kz</p>
                {estimate.valid_until && (
                  <p className="text-sm opacity-80">Valid until {new Date(estimate.valid_until).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </div>

          {/* Revision notice */}
          {estimate.is_revision && estimate.change_summary && (
            <div className="bg-orange-50 border-b border-orange-200 px-6 py-3 text-sm text-orange-800">
              <strong>Updated estimate:</strong> {estimate.change_summary}
            </div>
          )}

          <div className="px-6 py-5 space-y-5">
            {/* Customer + Vehicle */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Customer</p>
                <p className="font-semibold text-gray-900">{customer?.full_name ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Vehicle</p>
                <p className="font-semibold text-gray-900">{vehicle?.plate ?? '-'}</p>
                <p className="text-sm text-gray-500">{vehicle ? `${vehicle.make} ${vehicle.model}` : ''}</p>
              </div>
            </div>

            {/* DVI Summary */}
            {estimate.dvi_snapshot && estimate.dvi_snapshot.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Inspection Results</p>
                <div className="flex gap-3 text-sm">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
                    {estimate.dvi_snapshot.filter((i) => i.status === 'red').length} Urgent
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />
                    {estimate.dvi_snapshot.filter((i) => i.status === 'yellow').length} Monitor
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                    {estimate.dvi_snapshot.filter((i) => i.status === 'green').length} Good
                  </span>
                </div>
              </div>
            )}

            {/* Labour */}
            {estimate.labour_lines_snapshot.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Labour</p>
                {estimate.labour_lines_snapshot.map((line, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm border-b border-gray-50">
                    <span className="text-gray-700">{line.description as string}</span>
                    <span className="font-medium">{fmt(Number(line.subtotal))}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Parts */}
            {estimate.parts_lines_snapshot.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Parts</p>
                {estimate.parts_lines_snapshot.map((line, i) => (
                  <div key={i} className="flex justify-between py-1 text-sm border-b border-gray-50">
                    <span className="text-gray-700">{line.part_name as string} x{Number(line.quantity)}</span>
                    <span className="font-medium">{fmt(Number(line.subtotal))}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Totals */}
            <div className="border-t-2 border-gray-200 pt-3 space-y-1">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>{fmt(Number(estimate.labour_total) + Number(estimate.parts_total))}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>IVA ({estimate.tax_rate}%)</span>
                <span>{fmt(Number(estimate.tax_amount))}</span>
              </div>
              <div className="flex justify-between text-lg font-black text-gray-900 pt-1">
                <span>TOTAL</span>
                <span>{fmt(estimate.grand_total)} Kz</span>
              </div>
            </div>

            {/* Action buttons */}
            {isApprovable && (
              <div className="pt-4 space-y-3">
                <button
                  onClick={handleApprove}
                  disabled={submitting}
                  className="w-full rounded-xl bg-green-600 py-4 text-lg font-bold text-white hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-200"
                >
                  {submitting ? 'Processing...' : 'Approve Estimate'}
                </button>

                {!showRejectForm ? (
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="w-full rounded-xl border-2 border-gray-200 py-3 text-sm font-medium text-gray-600 hover:border-red-300 hover:text-red-600"
                  >
                    Reject
                  </button>
                ) : (
                  <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 space-y-3">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Please tell us why (optional)"
                      rows={2}
                      className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleReject}
                        disabled={submitting}
                        className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => setShowRejectForm(false)}
                        className="rounded-lg border px-4 py-2 text-sm text-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isApprovable && (
              <div className={`rounded-lg p-4 text-center ${
                estimate.status === 'approved' ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-600'
              }`}>
                <p className="font-semibold">
                  {estimate.status === 'approved' ? 'This estimate has been approved' :
                   estimate.status === 'rejected' ? 'This estimate has been rejected' :
                   `Status: ${estimate.status}`}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-3 text-center text-xs text-gray-400">
            Powered by MECANIX
          </div>
        </div>
      </div>
    </div>
  );
}
