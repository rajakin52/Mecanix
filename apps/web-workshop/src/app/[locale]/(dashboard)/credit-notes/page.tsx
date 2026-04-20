'use client';

import { useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useCreditNotesRegister } from '@/hooks/use-credit-notes';
import { formatCurrency, formatDate } from '@/lib/format';
import { SkeletonTable, EmptyState } from '@mecanix/ui-web';

export default function CreditNotesPage() {
  const locale = useLocale();
  const { data, isLoading, isError, error } = useCreditNotesRegister();

  const notes = (data ?? []) as Array<Record<string, unknown>>;

  const totalValue = notes.reduce((sum, n) => sum + Number(n.amount ?? 0), 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Credit notes</h1>
        <div className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm">
          <span className="text-gray-500">Total issued: </span>
          <span className="font-semibold text-gray-900">{formatCurrency(totalValue)}</span>
          <span className="ms-3 text-gray-500">({notes.length})</span>
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Failed to load: {error instanceof Error ? error.message : 'unknown error'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">NC Number</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Invoice</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Customer</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Reason</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Amount</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {notes.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icon="parts" title="No credit notes issued yet" description="Credit notes appear here after you issue one from an invoice." />
                  </td>
                </tr>
              ) : (
                notes.map((n) => {
                  const inv = n.invoice as Record<string, unknown> | null;
                  const cust = inv?.customer as Record<string, unknown> | null;
                  return (
                    <tr key={n.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{n.credit_note_number as string}</td>
                      <td className="px-4 py-3 text-sm">
                        {inv ? (
                          <Link
                            href={`/invoices/${inv.id as string}`}
                            className="text-primary-600 hover:underline"
                            locale={locale}
                          >
                            {inv.invoice_number as string}
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{cust?.full_name as string ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{(n.reason as string) ?? '-'}</td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                        {formatCurrency(Number(n.amount ?? 0))}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(n.created_at as string)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
