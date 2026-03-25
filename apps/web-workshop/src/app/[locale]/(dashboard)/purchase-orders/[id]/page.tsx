'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { usePurchaseOrder, useReceiveGoods } from '@/hooks/use-purchases';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    partial: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export default function PurchaseOrderDetailPage() {
  const t = useTranslations('purchases');
  const tc = useTranslations('common');
  const params = useParams();
  const id = params.id as string;

  const { data: po, isLoading } = usePurchaseOrder(id);
  const receiveMutation = useReceiveGoods();

  const [receiveLineId, setReceiveLineId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState(0);

  const handleReceive = async () => {
    if (!receiveLineId) return;
    await receiveMutation.mutateAsync({
      id,
      lines: [{ lineId: receiveLineId, receivedQty: receiveQty }],
    });
    setReceiveLineId(null);
    setReceiveQty(0);
  };

  if (isLoading) {
    return <p className="text-gray-500">{tc('loading')}</p>;
  }

  if (!po) {
    return <p className="text-gray-500">{t('noPOs')}</p>;
  }

  const lines = po.lines ?? [];

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
            <h1 className="text-2xl font-bold text-gray-900">{po.po_number}</h1>
            <p className="mt-1 text-sm text-gray-600">{t('vendor')}: {po.vendor?.name ?? po.vendor_name ?? '-'}</p>
          </div>
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusBadge(po.status)}`}>
            {t(`status_${po.status}`)}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">{t('orderDate')}</span>
            <p className="font-medium">{new Date(po.order_date).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-gray-500">{t('expectedDate')}</span>
            <p className="font-medium">{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '-'}</p>
          </div>
          <div>
            <span className="text-gray-500">{t('total')}</span>
            <p className="text-lg font-bold">{(po.total_amount ?? po.total ?? 0).toFixed(2)}</p>
          </div>
        </div>
        {po.notes && (
          <div className="mt-4 text-sm">
            <span className="text-gray-500">{tc('notes')}</span>
            <p className="mt-1 text-gray-700">{po.notes}</p>
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
              lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{line.description}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{line.part_id ?? '-'}</td>
                  <td className="px-4 py-3 text-end text-sm text-gray-700">{line.quantity}</td>
                  <td className="px-4 py-3 text-end text-sm text-gray-700">{(line.unit_cost ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-end text-sm">
                    <span
                      className={`font-medium ${
                        (line.received_qty ?? 0) >= (line.quantity ?? 0)
                          ? 'text-green-600'
                          : (line.received_qty ?? 0) > 0
                            ? 'text-yellow-600'
                            : 'text-gray-500'
                      }`}
                    >
                      {line.received_qty ?? 0} / {line.quantity ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">{(line.subtotal ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-end text-sm">
                    {(line.received_qty ?? 0) < (line.quantity ?? 0) && (
                      <button
                        onClick={() => {
                          setReceiveLineId(line.id);
                          setReceiveQty(line.quantity - line.received_qty);
                        }}
                        className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                      >
                        {t('receive')}
                      </button>
                    )}
                  </td>
                </tr>
              ))
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
