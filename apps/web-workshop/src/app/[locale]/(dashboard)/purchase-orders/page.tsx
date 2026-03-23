'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { usePurchaseOrders, useCreatePurchaseOrder, useVendors } from '@/hooks/use-purchases';
import { useParts } from '@/hooks/use-parts';

const STATUS_TABS = ['all', 'draft', 'sent', 'partial', 'complete'] as const;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    partial: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export default function PurchaseOrdersPage() {
  const t = useTranslations('purchases');
  const tc = useTranslations('common');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = usePurchaseOrders(
    page,
    undefined,
    statusFilter === 'all' ? undefined : statusFilter,
  );
  const { data: vendorsData } = useVendors();
  const { data: partsData } = useParts(1, '', undefined);
  const createMutation = useCreatePurchaseOrder();

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    vendorId: '',
    expectedDate: '',
    notes: '',
    lines: [{ partId: '', description: '', quantity: 1, unitCost: 0 }],
  });

  const addLine = () => {
    setForm({
      ...form,
      lines: [...form.lines, { partId: '', description: '', quantity: 1, unitCost: 0 }],
    });
  };

  const updateLine = (idx: number, field: keyof typeof form.lines[number], value: string | number) => {
    const lines = [...form.lines];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lines[idx] as any) = { ...lines[idx], [field]: value };
    setForm({ ...form, lines });
  };

  const removeLine = (idx: number) => {
    setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });
  };

  const handleCreate = async () => {
    try {
      setFormError(null);
      await createMutation.mutateAsync({
        vendorId: form.vendorId,
        expectedDate: form.expectedDate || undefined,
        notes: form.notes || undefined,
        lines: form.lines.map((l) => ({
          partId: l.partId,
          description: l.description,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
        })),
      });
      setShowModal(false);
      setForm({ vendorId: '', expectedDate: '', notes: '', lines: [{ partId: '', description: '', quantity: 1, unitCost: 0 }] });
      setSuccessMsg('Saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create purchase order');
    }
  };

  const vendors = Array.isArray(vendorsData) ? vendorsData : (vendorsData?.data ?? []);
  const parts = partsData?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('poTitle')}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('newPO')}
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setStatusFilter(tab); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'all' ? tc('viewAll') : t(`status_${tab}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-500">{tc('loading')}</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('poNumber')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('vendor')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('orderDate')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('expectedDate')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/purchase-orders/${po.id}`}>{po.po_number}</Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{po.vendor_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(po.status)}`}>
                          {t(`status_${po.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{new Date(po.order_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">{po.total.toFixed(2)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      {t('noPOs')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                {tc('previous')}
              </button>
              <span className="text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                {tc('next')}
              </button>
            </div>
          )}
        </>
      )}

      {/* New PO Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('newPO')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('vendor')}</label>
                  <select
                    value={form.vendorId}
                    onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="">{t('selectVendor')}</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('expectedDate')}</label>
                  <input
                    type="date"
                    value={form.expectedDate}
                    onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              {/* Lines */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">{t('lines')}</label>
                  <button
                    type="button"
                    onClick={addLine}
                    className="text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    + {t('addLine')}
                  </button>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line, idx) => (
                    <div key={idx} className="flex items-end gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500">{t('part')}</label>
                        <select
                          value={line.partId}
                          onChange={(e) => {
                            const partId = e.target.value;
                            const p = parts.find((pt: Record<string, unknown>) => pt.id === partId);
                            const lines = [...form.lines];
                            lines[idx] = {
                              ...lines[idx],
                              partId,
                              description: p ? (p.description as string) : lines[idx].description,
                              unitCost: p ? (p.unit_cost as number) : lines[idx].unitCost,
                            };
                            setForm({ ...form, lines });
                          }}
                          className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        >
                          <option value="">--</option>
                          {parts.map((p) => (
                            <option key={p.id} value={p.id}>{p.part_number} - {p.description}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500">{t('description')}</label>
                        <input
                          value={line.description}
                          onChange={(e) => updateLine(idx, 'description', e.target.value)}
                          className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="w-20">
                        <label className="block text-xs text-gray-500">{t('qty')}</label>
                        <input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                          className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="w-24">
                        <label className="block text-xs text-gray-500">{t('unitCost')}</label>
                        <input
                          type="number"
                          step="0.01"
                          value={line.unitCost}
                          onChange={(e) => updateLine(idx, 'unitCost', Number(e.target.value))}
                          className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      {form.lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="mb-0.5 text-red-500 hover:text-red-700"
                        >
                          &#x2715;
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !form.vendorId}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? tc('loading') : tc('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
