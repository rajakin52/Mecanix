'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBills, useCreateBill, useRecordPayment, useApproveBill, useVendors } from '@/hooks/use-purchases';
import { useToast } from '@mecanix/ui-web';

interface BillLine {
  partId?: string;
  partName: string;
  partNumber?: string;
  quantity: number;
  unitCost: number;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    unpaid: 'bg-red-100 text-red-700',
    partial: 'bg-yellow-100 text-yellow-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

const emptyLine = (): BillLine => ({ partName: '', quantity: 1, unitCost: 0 });

export default function BillsPage() {
  const t = useTranslations('purchases');
  const tc = useTranslations('common');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [payBillId, setPayBillId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('');
  const [payRef, setPayRef] = useState('');

  const { data, isLoading } = useBills(page);
  const { data: vendorsData } = useVendors();
  const createMutation = useCreateBill();
  const payMutation = useRecordPayment();
  const approveMutation = useApproveBill();

  const vendors = Array.isArray(vendorsData) ? vendorsData : (vendorsData?.data ?? []);

  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const [form, setForm] = useState({
    vendorId: '',
    billNumber: '',
    dueDate: '',
    notes: '',
  });
  const [lines, setLines] = useState<BillLine[]>([emptyLine()]);

  const addLine = () => setLines([...lines, emptyLine()]);
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: keyof BillLine, value: string | number) => {
    setLines(lines.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const lineTotal = (line: BillLine) => Math.round(line.quantity * line.unitCost * 100) / 100;
  const grandTotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);

  const handleCreate = async () => {
    try {
      setFormError(null);
      const validLines = lines.filter((l) => l.partName.trim());
      if (validLines.length === 0) {
        setFormError('At least one line item is required');
        return;
      }
      await createMutation.mutateAsync({
        vendorId: form.vendorId,
        billNumber: form.billNumber,
        dueDate: form.dueDate,
        notes: form.notes || undefined,
        lines: validLines.map((l) => ({
          partId: l.partId,
          partName: l.partName,
          partNumber: l.partNumber,
          quantity: l.quantity,
          unitCost: l.unitCost,
        })),
      });
      setShowModal(false);
      setForm({ vendorId: '', billNumber: '', dueDate: '', notes: '' });
      setLines([emptyLine()]);
      toast.success('Bill created successfully!');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create bill');
    }
  };

  const [payError, setPayError] = useState<string | null>(null);

  const handlePay = async () => {
    if (!payBillId) return;
    try {
      setPayError(null);
      await payMutation.mutateAsync({
        id: payBillId,
        amount: payAmount,
        paymentMethod: payMethod || undefined,
        reference: payRef || undefined,
      });
      setPayBillId(null);
      setPayAmount(0);
      setPayMethod('');
      setPayRef('');
      toast.success('Payment recorded successfully!');
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Failed to record payment');
    }
  };

  const handleApprove = async (billId: string) => {
    try {
      await approveMutation.mutateAsync(billId);
      toast.success('Bill approved — inventory updated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve bill');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('billsTitle')}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('newBill')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">{tc('loading')}</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('billNumber')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('vendor')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('amount')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('paid')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Approved</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('dueDate')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((bill) => (
                    <tr key={bill.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{bill.bill_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{bill.vendor?.name ?? bill.vendor_name}</td>
                      <td className="px-4 py-3 text-end text-sm text-gray-700">{Number(bill.amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-end text-sm text-gray-700">{Number(bill.paid_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(bill.status)}`}>
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {bill.approved_at ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Yes</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{new Date(bill.due_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-end text-sm space-x-2">
                        {!bill.approved_at && (
                          <button
                            onClick={() => handleApprove(bill.id)}
                            disabled={approveMutation.isPending}
                            className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Approve
                          </button>
                        )}
                        {bill.status !== 'paid' && (
                          <button
                            onClick={() => {
                              setPayBillId(bill.id);
                              setPayAmount(Number(bill.amount) - Number(bill.paid_amount));
                            }}
                            className="rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                          >
                            {t('recordPayment')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                      {t('noBills')}
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

      {/* New Bill Modal — with line items */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('newBill')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
              )}

              {/* Bill header */}
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
                  <label className="block text-sm font-medium text-gray-700">{t('billNumber')}</label>
                  <input
                    value={form.billNumber}
                    onChange={(e) => setForm({ ...form, billNumber: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('dueDate')}</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                  <input
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700">Line Items</label>
                  <button
                    type="button"
                    onClick={addLine}
                    className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
                  >
                    + Add Line
                  </button>
                </div>
                <div className="overflow-hidden rounded-md border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-start text-xs font-medium text-gray-500">Part Name</th>
                        <th className="px-3 py-2 text-start text-xs font-medium text-gray-500">Part #</th>
                        <th className="px-3 py-2 text-end text-xs font-medium text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-end text-xs font-medium text-gray-500">Unit Cost</th>
                        <th className="px-3 py-2 text-end text-xs font-medium text-gray-500">Total</th>
                        <th className="px-3 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lines.map((line, idx) => (
                        <tr key={idx}>
                          <td className="px-2 py-1.5">
                            <input
                              value={line.partName}
                              onChange={(e) => updateLine(idx, 'partName', e.target.value)}
                              placeholder="Part name"
                              className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              value={line.partNumber ?? ''}
                              onChange={(e) => updateLine(idx, 'partNumber', e.target.value)}
                              placeholder="Optional"
                              className="w-full rounded border border-gray-200 px-2 py-1 text-sm"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                              className="w-20 rounded border border-gray-200 px-2 py-1 text-sm text-end"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              min={0}
                              value={line.unitCost}
                              onChange={(e) => updateLine(idx, 'unitCost', Number(e.target.value))}
                              className="w-24 rounded border border-gray-200 px-2 py-1 text-sm text-end"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-end font-medium text-gray-700">
                            {lineTotal(line).toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {lines.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLine(idx)}
                                className="text-red-400 hover:text-red-600 text-xs"
                              >
                                &#x2715;
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-end text-sm font-semibold text-gray-700">
                          Total:
                        </td>
                        <td className="px-3 py-2 text-end text-sm font-bold text-gray-900">
                          {grandTotal.toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !form.vendorId || !form.billNumber || lines.every((l) => !l.partName.trim())}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? tc('loading') : tc('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {payBillId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('recordPayment')}</h2>
              <button onClick={() => setPayBillId(null)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              {payError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{payError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('paymentAmount')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  min={0}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">Select method</option>
                  <option value="cash">Cash</option>
                  <option value="transfer">Bank Transfer</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Reference</label>
                <input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Payment reference"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPayBillId(null)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handlePay}
                  disabled={payMutation.isPending || payAmount <= 0}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {payMutation.isPending ? tc('loading') : tc('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
