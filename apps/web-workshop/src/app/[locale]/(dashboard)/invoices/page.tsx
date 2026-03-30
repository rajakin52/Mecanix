'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useInvoices, useGenerateInvoice, useFinancialSummary } from '@/hooks/use-invoices';
import { useJobs } from '@/hooks/use-jobs';
import { Link } from '@/i18n/navigation';
import { SkeletonTable } from '@mecanix/ui-web';

const STATUS_TABS = [
  { key: undefined, label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'partial', label: 'Partial' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

export default function InvoicesPage() {
  const t = useTranslations('invoices');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [activeStatus, setActiveStatus] = useState<string | undefined>(undefined);
  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const { data, isLoading } = useInvoices(page, activeStatus);
  const { data: summaryData } = useFinancialSummary();
  const generateMutation = useGenerateInvoice();

  // Fetch jobs in ready/quality_check status for the generate modal
  const { data: readyJobsData } = useJobs(1, '', 'ready');
  const { data: qcJobsData } = useJobs(1, '', 'quality_check');
  const eligibleJobs = [
    ...((readyJobsData?.data as Array<Record<string, unknown>> | undefined) ?? []),
    ...((qcJobsData?.data as Array<Record<string, unknown>> | undefined) ?? []),
  ];

  const [genJobCardId, setGenJobCardId] = useState('');
  const [genDueDate, setGenDueDate] = useState('');
  const [genNotes, setGenNotes] = useState('');
  const [genCustomerPortion, setGenCustomerPortion] = useState('');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(locale, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const handleGenerate = async () => {
    if (!genJobCardId) return;
    await generateMutation.mutateAsync({
      jobCardId: genJobCardId,
      dueDate: genDueDate || undefined,
      notes: genNotes || undefined,
      customerPortion: genCustomerPortion ? Number(genCustomerPortion) : undefined,
    });
    setShowGenerateModal(false);
    setGenJobCardId('');
    setGenDueDate('');
    setGenNotes('');
    setGenCustomerPortion('');
  };

  const summary = summaryData as Record<string, number> | undefined;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowGenerateModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('generateInvoice')}
        </button>
      </div>

      {/* Financial Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">{t('totalReceivables')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {summary ? formatCurrency(summary.total_receivables ?? 0) : '...'}
          </p>
        </div>
        <div className={`rounded-lg border bg-white p-5 shadow-sm ${summary && (summary.overdue_amount ?? 0) > 0 ? 'border-red-200' : 'border-gray-200'}`}>
          <p className="text-sm font-medium text-gray-500">{t('overdueAmount')}</p>
          <p className={`mt-1 text-2xl font-bold ${summary && (summary.overdue_amount ?? 0) > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {summary ? formatCurrency(summary.overdue_amount ?? 0) : '...'}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-gray-500">{t('revenueThisMonth')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {summary ? formatCurrency(summary.revenue_this_month ?? 0) : '...'}
          </p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {STATUS_TABS.map((s) => (
          <button
            key={s.label}
            onClick={() => { setActiveStatus(s.key); setPage(1); }}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeStatus === s.key
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={8} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('invoiceNumber')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('customer')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('jobCard')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('grandTotal')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('paid')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('balanceDue')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('date')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((inv: Record<string, unknown>) => (
                    <tr key={inv.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/invoices/${inv.id as string}`}>
                          {inv.invoice_number as string}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(inv.customers as Record<string, string> | undefined)?.full_name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {(inv.job_cards as Record<string, string> | undefined)?.job_number ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                        {formatCurrency(inv.grand_total as number)}
                      </td>
                      <td className="px-4 py-3 text-end text-sm text-gray-700">
                        {formatCurrency(inv.paid_amount as number)}
                      </td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                        {formatCurrency(inv.balance_due as number)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status as string] ?? 'bg-gray-100 text-gray-600'}`}>
                          {(inv.status as string).replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(inv.invoice_date as string).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                      {t('noInvoices')}
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
              <span className="text-sm text-gray-600">
                {page} / {data.meta.totalPages}
              </span>
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

      {/* Generate Invoice Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('generateInvoice')}</h2>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &#x2715;
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('selectJobCard')}</label>
                <select
                  value={genJobCardId}
                  onChange={(e) => setGenJobCardId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">{t('selectJobCard')}</option>
                  {eligibleJobs.map((job) => (
                    <option key={job.id as string} value={job.id as string}>
                      {job.job_number as string} - {(job.customers as Record<string, string> | undefined)?.full_name ?? ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('dueDate')}</label>
                  <input
                    type="date"
                    value={genDueDate}
                    onChange={(e) => setGenDueDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('customerPortion')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={genCustomerPortion}
                    onChange={(e) => setGenCustomerPortion(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea
                  value={genNotes}
                  onChange={(e) => setGenNotes(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="rounded-md border px-4 py-2 text-sm"
                >
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending || !genJobCardId}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {generateMutation.isPending ? tc('loading') : t('generateInvoice')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
