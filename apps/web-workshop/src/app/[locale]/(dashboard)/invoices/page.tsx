'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useInvoices, useGenerateInvoice, useFinancialSummary } from '@/hooks/use-invoices';
import { useJobs } from '@/hooks/use-jobs';
import { Link } from '@/i18n/navigation';
import { SkeletonTable, StatusBadge, EmptyState, SortableHeader, sortData, type SortDirection } from '@mecanix/ui-web';

const STATUS_TABS = [
  { key: undefined, label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'sent', label: 'Sent' },
  { key: 'partial', label: 'Partial' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cancelled', label: 'Cancelled' },
] as const;

export default function InvoicesPage() {
  const t = useTranslations('invoices');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [activeStatus, setActiveStatus] = useState<string | undefined>(undefined);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = (field: string, dir: SortDirection) => {
    setSortField(dir ? field : null);
    setSortDir(dir);
  };

  const { data, isLoading } = useInvoices(page, activeStatus);
  const { data: summaryData } = useFinancialSummary();
  const generateMutation = useGenerateInvoice();

  // Fetch jobs in ready/quality_check status for the generate modal
  const { data: readyJobsData } = useJobs(1, '', 'ready');
  const { data: qcJobsData } = useJobs(1, '', 'quality_check');
  const eligibleJobs = [
    ...(readyJobsData?.data ?? []),
    ...(qcJobsData?.data ?? []),
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
                  <SortableHeader label={t('invoiceNumber')} field="invoice_number" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('customer')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('jobCard')}</th>
                  <SortableHeader label={t('grandTotal')} field="grand_total" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} align="end" />
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('paid')}</th>
                  <SortableHeader label={t('balanceDue')} field="balance_due" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} align="end" />
                  <SortableHeader label={t('status')} field="status" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <SortableHeader label={t('date')} field="invoice_date" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(() => {
                  const invoices = data?.data ?? [];
                  const sorted = sortData(invoices as unknown as Record<string, unknown>[], sortField, sortDir) as unknown as typeof invoices;
                  return sorted.length > 0 ? (
                  sorted.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/invoices/${inv.id}`}>
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {inv.customers?.full_name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {inv.job_cards?.job_number ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                        {formatCurrency(inv.grand_total)}
                      </td>
                      <td className="px-4 py-3 text-end text-sm text-gray-700">
                        {formatCurrency(inv.paid_amount)}
                      </td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                        {formatCurrency(inv.balance_due)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(inv.invoice_date).toLocaleDateString(locale)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState icon="invoices" title="No invoices found" description="Generate an invoice from a completed job" />
                    </td>
                  </tr>
                );
                })()}
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
                    <option key={job.id} value={job.id}>
                      {job.job_number} - {job.customers?.full_name ?? ''}
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
