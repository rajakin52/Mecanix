'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useInvoice, useMarkAsSent, useRecordPayment, useCreateCreditNote } from '@/hooks/use-invoices';
import { useLabourLines, usePartsLines } from '@/hooks/use-jobs';
import { Link } from '@/i18n/navigation';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

const PAYMENT_METHODS = ['cash', 'transfer', 'card', 'mpesa', 'pix', 'multicaixa', 'other'];

export default function InvoiceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('invoices');
  const tc = useTranslations('common');
  const locale = useLocale();

  const { data: invoice, isLoading } = useInvoice(id);
  const markAsSentMutation = useMarkAsSent();
  const payMutation = useRecordPayment();
  const creditNoteMutation = useCreateCreditNote();

  // Fetch labour and parts lines from the job card
  const jobCardId = (invoice as Record<string, unknown> | undefined)?.job_card_id as string | undefined;
  const { data: labourLines } = useLabourLines(jobCardId ?? '');
  const { data: partsLines } = usePartsLines(jobCardId ?? '');

  // Payment modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');

  // Credit note modal state
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(locale, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const handleMarkAsSent = async () => {
    await markAsSentMutation.mutateAsync(id);
  };

  const handleRecordPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) return;
    await payMutation.mutateAsync({
      invoiceId: id,
      amount: Number(payAmount),
      paymentMethod: payMethod,
      reference: payRef || undefined,
      notes: payNotes || undefined,
    });
    setShowPayModal(false);
    setPayAmount('');
    setPayMethod('cash');
    setPayRef('');
    setPayNotes('');
  };

  const handleCreditNote = async () => {
    if (!creditAmount || Number(creditAmount) <= 0 || !creditReason) return;
    await creditNoteMutation.mutateAsync({
      invoiceId: id,
      amount: Number(creditAmount),
      reason: creditReason,
    });
    setShowCreditModal(false);
    setCreditAmount('');
    setCreditReason('');
  };

  if (isLoading) {
    return <p className="text-gray-500">{tc('loading')}</p>;
  }

  if (!invoice) {
    return <p className="text-gray-500">{t('noInvoices')}</p>;
  }

  const inv = invoice as Record<string, unknown>;
  const status = inv.status as string;
  const payments = (inv.payments as Array<Record<string, unknown>>) ?? [];
  const creditNotes = (inv.credit_notes as Array<Record<string, unknown>>) ?? [];

  return (
    <div>
      {/* Back link */}
      <div className="mb-4">
        <Link href="/invoices" className="text-sm text-primary-600 hover:underline">
          &larr; {tc('back')}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">{inv.invoice_number as string}</h1>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
            {status.replace(/_/g, ' ')}
          </span>
        </div>
        <div className="flex gap-2">
          {status === 'draft' && (
            <button
              onClick={handleMarkAsSent}
              disabled={markAsSentMutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {markAsSentMutation.isPending ? tc('loading') : t('markAsSent')}
            </button>
          )}
        </div>
      </div>

      {/* Customer & Job Info */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('customer')}</p>
          <p className="mt-1 text-sm font-medium text-gray-900">
            {((inv.customer ?? inv.customers) as Record<string, string> | undefined)?.full_name ?? '-'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('jobCard')}</p>
          <Link href={`/jobs/${inv.job_card_id as string}`} className="mt-1 block text-sm font-medium text-primary-600 hover:underline">
            {((inv.job_card ?? inv.job_cards) as Record<string, string> | undefined)?.job_number ?? '-'}
          </Link>
        </div>
      </div>

      {/* Labour Lines */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('labourTotal')}</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Description</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Hours</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Rate</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {labourLines && (labourLines as Array<Record<string, unknown>>).length > 0 ? (
                (labourLines as Array<Record<string, unknown>>).map((line, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-700">{line.description as string}</td>
                    <td className="px-4 py-2 text-end text-sm text-gray-700">{line.hours as number}</td>
                    <td className="px-4 py-2 text-end text-sm text-gray-700">{formatCurrency(line.rate as number)}</td>
                    <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">{formatCurrency(line.subtotal as number)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-400">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Parts Lines */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t('partsTotal')}</h2>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Part</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Qty</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Sell Price</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {partsLines && (partsLines as Array<Record<string, unknown>>).length > 0 ? (
                (partsLines as Array<Record<string, unknown>>).map((line, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-700">{(line.part_name ?? line.description) as string}</td>
                    <td className="px-4 py-2 text-end text-sm text-gray-700">{line.quantity as number}</td>
                    <td className="px-4 py-2 text-end text-sm text-gray-700">{formatCurrency(line.sell_price as number)}</td>
                    <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">{formatCurrency(line.subtotal as number)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-400">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals Card */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('grandTotal')}</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('labourTotal')}</span>
            <span className="text-gray-900">{formatCurrency(inv.labour_total as number)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('partsTotal')}</span>
            <span className="text-gray-900">{formatCurrency(inv.parts_total as number)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-100 pt-2 text-sm">
            <span className="text-gray-500">{t('subtotal')}</span>
            <span className="text-gray-900">{formatCurrency(inv.subtotal as number)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('taxRate')} ({inv.tax_rate as number}%)</span>
            <span className="text-gray-900">{formatCurrency(inv.tax_amount as number)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
            <span className="text-gray-900">{t('grandTotal')}</span>
            <span className="text-gray-900">{formatCurrency(inv.grand_total as number)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('paid')}</span>
            <span className="text-green-600">{formatCurrency(inv.paid_amount as number)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
            <span className="text-gray-900">{t('balanceDue')}</span>
            <span className={(inv.balance_due as number) > 0 ? 'text-red-600' : 'text-gray-900'}>
              {formatCurrency(inv.balance_due as number)}
            </span>
          </div>
        </div>

        {/* Insurance Split */}
        {(inv.is_insurance as boolean) && (
          <div className="mt-4 rounded-md border border-purple-200 bg-purple-50 p-4">
            <p className="mb-2 text-sm font-semibold text-purple-700">{t('insuranceSplit')}</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('customerPortion')}</span>
              <span className="font-medium text-gray-900">
                {inv.customer_portion != null ? formatCurrency(inv.customer_portion as number) : '-'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t('insurancePortion')}</span>
              <span className="font-medium text-gray-900">
                {inv.insurance_portion != null ? formatCurrency(inv.insurance_portion as number) : '-'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Dates & Notes */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">{t('date')}</p>
          <p className="mt-1 text-sm text-gray-900">
            {new Date(inv.invoice_date as string).toLocaleDateString(locale)}
          </p>
        </div>
        {inv.due_date && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">{t('dueDate')}</p>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(inv.due_date as string).toLocaleDateString(locale)}
            </p>
          </div>
        )}
        {inv.notes && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">{tc('notes')}</p>
            <p className="mt-1 text-sm text-gray-700">{inv.notes as string}</p>
          </div>
        )}
      </div>

      {/* Payments Section */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('payments')}</h2>
          {status !== 'paid' && status !== 'cancelled' && (
            <button
              onClick={() => {
                setPayAmount(String(inv.balance_due as number));
                setShowPayModal(true);
              }}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              {t('recordPayment')}
            </button>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('date')}</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('paymentAmount')}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('paymentMethod')}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('reference')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {payments.length > 0 ? (
                payments.map((pay, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {new Date(pay.created_at as string).toLocaleDateString(locale)}
                    </td>
                    <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">
                      {formatCurrency(pay.amount as number)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{(pay.payment_method ?? pay.paymentMethod) as string}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{(pay.reference as string) ?? '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-sm text-gray-400">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Notes Section */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('creditNotes')}</h2>
          {status !== 'cancelled' && (
            <button
              onClick={() => setShowCreditModal(true)}
              className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700"
            >
              {t('issueCreditNote')}
            </button>
          )}
        </div>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('date')}</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('paymentAmount')}</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('reason')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {creditNotes.length > 0 ? (
                creditNotes.map((cn, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {new Date(cn.created_at as string).toLocaleDateString(locale)}
                    </td>
                    <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">
                      {formatCurrency(cn.amount as number)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{cn.reason as string}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-400">-</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('recordPayment')}</h2>
              <button onClick={() => setShowPayModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('paymentAmount')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('paymentMethod')}</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('reference')}</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowPayModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleRecordPayment}
                  disabled={payMutation.isPending || !payAmount || Number(payAmount) <= 0}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {payMutation.isPending ? tc('loading') : tc('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Credit Note Modal */}
      {showCreditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('issueCreditNote')}</h2>
              <button onClick={() => setShowCreditModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('paymentAmount')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('reason')}</label>
                <textarea
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowCreditModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleCreditNote}
                  disabled={creditNoteMutation.isPending || !creditAmount || Number(creditAmount) <= 0 || !creditReason}
                  className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {creditNoteMutation.isPending ? tc('loading') : tc('confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
