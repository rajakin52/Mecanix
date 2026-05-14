'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { usePurchaseOrder, useReceiveGoods, useSubmitPO, useApprovePO, useRejectPO, useReopenPO } from '@/hooks/use-purchases';
import { LandedCostsPanel } from '@/components/purchase-orders/LandedCostsPanel';
import { useToast } from '@mecanix/ui-web';
import { formatDate } from '@/lib/format';
import { CheckCircle2, XCircle, Send, RotateCcw, Hourglass } from 'lucide-react';

function statusBadge(status: string | undefined) {
  if (!status) return 'bg-gray-100 text-gray-600';
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending_approval: 'bg-amber-100 text-amber-800',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    sent: 'bg-blue-100 text-blue-700',
    partial: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function safe(val: unknown): number {
  return typeof val === 'number' ? val : Number(val) || 0;
}

export default function PurchaseOrderDetailPage() {
  const t = useTranslations('purchases');
  const tc = useTranslations('common');
  const params = useParams();
  const id = params?.id as string;

  const { data: po, isLoading, error } = usePurchaseOrder(id);
  const receiveMutation = useReceiveGoods();
  const submitMutation = useSubmitPO(id);
  const approveMutation = useApprovePO(id);
  const rejectMutation = useRejectPO(id);
  const reopenMutation = useReopenPO(id);
  const toast = useToast();

  const [receiveLineId, setReceiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState(0);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleSubmit = async () => {
    try {
      const r = await submitMutation.mutateAsync();
      const result = r as unknown as { autoApproved?: boolean };
      toast.success(result.autoApproved ? 'PO auto-approved (under threshold)' : 'PO submitted for approval');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed');
    }
  };
  const handleApprove = async () => {
    try {
      await approveMutation.mutateAsync();
      toast.success('PO approved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Approve failed');
    }
  };
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Reason is required');
      return;
    }
    try {
      await rejectMutation.mutateAsync(rejectReason.trim());
      toast.success('PO rejected');
      setRejectOpen(false);
      setRejectReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reject failed');
    }
  };
  const handleReopen = async () => {
    try {
      await reopenMutation.mutateAsync();
      toast.success('PO reopened — back to draft');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reopen failed');
    }
  };

  const handleReceive = async () => {
    if (!receiveLineId) return;
    try {
      await receiveMutation.mutateAsync({
        id,
        lineId: receiveLineId,
        receivedQty: receiveQty,
      });
      setReceiveLineId(null);
      setReceiveQty(0);
    } catch {
      // handled by mutation state
    }
  };

  if (isLoading) {
    return <p className="text-gray-500">{tc('loading')}</p>;
  }

  if (error || !po) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{t('noPOs')}</p>
        <Link href="/purchase-orders" className="text-sm text-primary-600 hover:text-primary-700 mt-2 inline-block">
          &larr; {tc('back')}
        </Link>
      </div>
    );
  }

  // Safe access — handle any shape the API might return
  const poData = po;
  const vendorName = poData.vendor?.name ?? poData.vendor_name ?? '-';
  const total = safe(poData.total_amount ?? poData.total);
  const lines = (Array.isArray(poData.lines) ? poData.lines : []) as unknown as Array<Record<string, unknown>>;
  const status = poData.status ?? 'draft';
  const poNumber = poData.po_number ?? '-';
  const orderDate = poData.order_date ? new Date(poData.order_date).toLocaleDateString() : '-';
  const expectedDate = poData.expected_date ? new Date(poData.expected_date).toLocaleDateString() : '-';
  const notes = poData.notes ?? '';

  return (
    <div>
      <div className="mb-6">
        <Link href="/purchase-orders" className="text-sm text-primary-600 hover:text-primary-700">
          &larr; {tc('back')}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{poNumber}</h1>
            <p className="mt-1 text-sm text-gray-600">{t('vendor')}: {vendorName as string}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusBadge(status)}`}>
              {status.replace(/_/g, ' ')}
            </span>
            {status === 'draft' && (
              <button
                onClick={handleSubmit}
                disabled={submitMutation.isPending || lines.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Submit for approval
              </button>
            )}
            {status === 'pending_approval' && (
              <>
                <button
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </button>
                <button
                  onClick={() => setRejectOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </button>
              </>
            )}
            {status === 'rejected' && (
              <button
                onClick={handleReopen}
                disabled={reopenMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reopen
              </button>
            )}
          </div>
        </div>

        {/* Approval history */}
        {(() => {
          const pd = poData as unknown as Record<string, unknown>;
          const submittedAt = pd.submitted_at as string | null;
          const approvedAt = pd.approved_at as string | null;
          const rejectedAt = pd.rejected_at as string | null;
          const rejReason = pd.rejection_reason as string | null;
          const any = submittedAt || approvedAt || rejectedAt;
          if (!any) return null;
          return (
            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <Hourglass className="h-3 w-3" /> Approval history
              </div>
              <ul className="space-y-1 text-sm">
                {submittedAt && (
                  <li className="flex items-center gap-2 text-gray-700">
                    <Send className="h-3 w-3 text-primary-600" />
                    Submitted on <span className="font-medium">{formatDate(submittedAt)}</span>
                  </li>
                )}
                {approvedAt && (
                  <li className="flex items-center gap-2 text-green-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Approved on <span className="font-medium">{formatDate(approvedAt)}</span>
                  </li>
                )}
                {rejectedAt && (
                  <li className="flex items-start gap-2 text-red-700">
                    <XCircle className="h-3 w-3 mt-1" />
                    <span>
                      Rejected on <span className="font-medium">{formatDate(rejectedAt)}</span>
                      {rejReason && <span className="block text-xs text-red-600 mt-0.5">Reason: {rejReason}</span>}
                    </span>
                  </li>
                )}
              </ul>
            </div>
          );
        })()}
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{t('orderDate')}</span>
            <p className="font-medium">{orderDate}</p>
          </div>
          <div>
            <span className="text-gray-500">{t('expectedDate')}</span>
            <p className="font-medium">{expectedDate}</p>
          </div>
          <div>
            <span className="text-gray-500">{t('total')}</span>
            <p className="text-lg font-bold">{total.toFixed(2)}</p>
          </div>
        </div>
        {notes && (
          <div className="mt-4 text-sm">
            <span className="text-gray-500">{tc('notes')}</span>
            <p className="mt-1 text-gray-700">{notes}</p>
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('description')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('part')}</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('qty')}</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('unitCost')}</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('received')}</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('subtotal')}</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {lines.length > 0 ? (
              lines.map((line) => {
                const lineId = line.id as string;
                const desc = (line.description as string) ?? '-';
                const partId = (line.part_id as string) ?? ((line.part as Record<string, unknown>)?.part_number as string) ?? '-';
                const qty = safe(line.quantity);
                const unitCost = safe(line.unit_cost);
                const receivedQty = safe(line.received_qty);
                const subtotal = safe(line.subtotal);

                return (
                  <tr key={lineId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{desc}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{partId}</td>
                    <td className="px-4 py-3 text-end text-sm text-gray-700">{qty}</td>
                    <td className="px-4 py-3 text-end text-sm text-gray-700">{unitCost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-end text-sm">
                      <span
                        className={`font-medium ${
                          receivedQty >= qty
                            ? 'text-green-600'
                            : receivedQty > 0
                              ? 'text-yellow-600'
                              : 'text-gray-500'
                        }`}
                      >
                        {receivedQty} / {qty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">{subtotal.toFixed(2)}</td>
                    <td className="px-4 py-3 text-end text-sm">
                      {receivedQty < qty && (
                        <button
                          onClick={() => {
                            setReceiveLineId(lineId);
                            setReceiveQty(qty - receivedQty);
                          }}
                          className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                        >
                          {t('receive')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                  {t('noLines')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Landed costs */}
      {lines.length > 0 && (
        <LandedCostsPanel
          poId={id}
          lines={lines.map((l) => ({
            id: l.id as string,
            description: (l.description as string) ?? '',
            part_id: (l.part_id as string | null) ?? null,
            quantity: safe(l.quantity),
            unit_cost: safe(l.unit_cost),
            landed_unit_cost: l.landed_unit_cost == null ? null : Number(l.landed_unit_cost),
          }))}
          initialCosts={(() => {
            const raw = (poData as unknown as Record<string, unknown>).additional_costs;
            return Array.isArray(raw) ? (raw as Array<{ type: string; amount: number; allocation_method?: 'by_value' | 'by_quantity' }>) : undefined;
          })()}
        />
      )}

      {/* Reject Modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Reject PO</h2>
              <button onClick={() => setRejectOpen(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <label className="block text-sm font-medium text-gray-700">Reason *</label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why are you rejecting this PO?"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setRejectOpen(false)} className="rounded-md border px-4 py-2 text-sm">Back</button>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMutation.isPending ? 'Rejecting…' : 'Reject PO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receive Modal */}
      {receiveLineId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('receiveGoods')}</h2>
              <button onClick={() => setReceiveLineId(null)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('receivedQty')}</label>
                <input
                  type="number"
                  value={receiveQty}
                  onChange={(e) => setReceiveQty(Number(e.target.value))}
                  min={0}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setReceiveLineId(null)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleReceive}
                  disabled={receiveMutation.isPending || receiveQty <= 0}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {receiveMutation.isPending ? tc('loading') : tc('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
