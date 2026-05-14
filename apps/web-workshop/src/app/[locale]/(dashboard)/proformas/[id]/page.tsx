'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useToast, SkeletonPage } from '@mecanix/ui-web';
import {
  useProforma,
  useSendProforma,
  useCancelProforma,
  useConvertProforma,
} from '@/hooks/use-proformas';
import { formatCurrency, formatDate } from '@/lib/format';
import { ChevronLeft, Send, X, ArrowRight, Printer } from 'lucide-react';

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    converted: 'bg-purple-100 text-purple-700',
    expired: 'bg-amber-100 text-amber-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export default function ProformaDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const toast = useToast();
  const locale = useLocale();

  const { data: proforma, isLoading } = useProforma(id);
  const send = useSendProforma();
  const cancel = useCancelProforma();
  const convert = useConvertProforma();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  if (isLoading || !proforma) return <SkeletonPage />;

  const isFinal = proforma.status === 'converted' || proforma.status === 'cancelled';

  const handleSend = async () => {
    try {
      await send.mutateAsync(id);
      toast.success('Proforma marked as sent');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Provide a reason');
      return;
    }
    try {
      await cancel.mutateAsync({ id, reason: cancelReason.trim() });
      toast.success('Proforma cancelled');
      setCancelOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleConvert = async () => {
    try {
      const inv = await convert.mutateAsync(id);
      toast.success(`Invoice ${inv.invoice_number} created`);
      router.push(`/invoices/${inv.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Conversion failed');
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Link href="/proformas" className="inline-flex items-center text-sm text-primary-600 hover:underline">
          <ChevronLeft className="h-4 w-4" /> Proformas
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-gray-900">{proforma.proforma_number}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(proforma.status)}`}>
              {proforma.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {proforma.customer?.full_name ?? '—'} · Issued {formatDate(proforma.issue_date)}
            {proforma.valid_until ? ` · Valid until ${formatDate(proforma.valid_until)}` : ''}
          </p>
          {proforma.converted_invoice_id && (
            <p className="mt-2 text-xs text-purple-700">
              Converted →{' '}
              <Link href={`/invoices/${proforma.converted_invoice_id}`} className="font-medium underline">
                view invoice
              </Link>
            </p>
          )}
          {proforma.cancellation_reason && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-1 text-xs text-red-700">
              Cancelled: {proforma.cancellation_reason}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.open(`/${locale}/print/proforma/${id}`, '_blank')}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </button>
          {!isFinal && proforma.status === 'draft' && (
              <button
                onClick={handleSend}
                disabled={send.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Mark sent
              </button>
            )}
          {!isFinal && (
            <>
              <button
                onClick={handleConvert}
                disabled={convert.isPending}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                {convert.isPending ? 'Converting…' : 'Convert to Invoice'}
              </button>
              <button
                onClick={() => setCancelOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Part #</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Description</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Qty</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Unit price</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">VAT</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(proforma.lines ?? []).map((line) => (
              <tr key={line.id}>
                <td className="px-4 py-2 font-mono text-xs text-gray-700">{line.part_number ?? '—'}</td>
                <td className="px-4 py-2 text-gray-700">{line.part_name}</td>
                <td className="px-4 py-2 text-end text-gray-700">{line.quantity}</td>
                <td className="px-4 py-2 text-end text-gray-700">{formatCurrency(line.sell_price)}</td>
                <td className="px-4 py-2 text-end text-gray-500">{Number(line.tax_rate ?? 0).toFixed(0)}%</td>
                <td className="px-4 py-2 text-end font-medium text-gray-900">{formatCurrency(line.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 text-sm">
            <tr>
              <td colSpan={5} className="px-4 py-2 text-end text-gray-600">Subtotal</td>
              <td className="px-4 py-2 text-end text-gray-900">{formatCurrency(proforma.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-2 text-end text-gray-600">VAT</td>
              <td className="px-4 py-2 text-end text-gray-900">{formatCurrency(proforma.tax_amount)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="px-4 py-3 text-end text-base font-semibold text-gray-700">Total</td>
              <td className="px-4 py-3 text-end text-base font-bold text-gray-900">{formatCurrency(proforma.grand_total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {proforma.notes && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</div>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{proforma.notes}</p>
        </div>
      )}

      {cancelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Cancel proforma</h2>
              <button onClick={() => setCancelOpen(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <label className="block text-sm font-medium text-gray-700">Reason *</label>
            <textarea
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Why are you cancelling this proforma?"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setCancelOpen(false)} className="rounded-md border px-4 py-2 text-sm">
                Back
              </button>
              <button
                onClick={handleCancel}
                disabled={cancel.isPending || !cancelReason.trim()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancel.isPending ? 'Cancelling…' : 'Cancel proforma'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
