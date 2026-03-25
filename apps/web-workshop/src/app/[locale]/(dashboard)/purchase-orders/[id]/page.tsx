'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { usePurchaseOrder, useReceiveGoods } from '@/hooks/use-purchases';

function statusBadge(status: string | undefined) {
  if (!status) return 'bg-gray-100 text-gray-600';
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    partial: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700',
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

  const [receiveLineId, setReceiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState(0);

  const handleReceive = async () => {
    if (!receiveLineId) return;
    try {
      await receiveMutation.mutateAsync({
        id,
        lines: [{ lineId: receiveLineId, receivedQty: receiveQty }],
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
  const poData = po as Record<string, unknown>;
  const vendorName = (poData.vendor as Record<string, unknown>)?.name ?? poData.vendor_name ?? '-';
  const total = safe(poData.total_amount ?? poData.total);
  const lines = (Array.isArray(poData.lines) ? poData.lines : []) as Array<Record<string, unknown>>;
  const status = (poData.status as string) ?? 'draft';
  const poNumber = (poData.po_number as string) ?? '-';
  const orderDate = poData.order_date ? new Date(poData.order_date as string).toLocaleDateString() : '-';
  const expectedDate = poData.expected_date ? new Date(poData.expected_date as string).toLocaleDateString() : '-';
  const notes = (poData.notes as string) ?? '';

  return (
    <div>
      <div className="mb-6">
        <Link href="/purchase-orders" className="text-sm text-primary-600 hover:text-primary-700">
          &larr; {tc('back')}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{poNumber}</h1>
            <p className="mt-1 text-sm text-gray-600">{t('vendor')}: {vendorName as string}</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusBadge(status)}`}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>
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
