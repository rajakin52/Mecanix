'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useProformas } from '@/hooks/use-proformas';
import { formatCurrency, formatDate } from '@/lib/format';
import { SkeletonTable, EmptyState } from '@mecanix/ui-web';
import { Search } from 'lucide-react';

const STATUS_TABS = ['all', 'draft', 'sent', 'accepted', 'converted', 'cancelled'] as const;

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

export default function ProformasPage() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);
  // Reset to page 1 whenever the search changes
  useEffect(() => { setPage(1); }, [debouncedSearch]);
  const { data, isLoading } = useProformas(
    page,
    statusFilter === 'all' ? undefined : statusFilter,
    undefined,
    debouncedSearch || undefined,
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Proformas</h1>
          <p className="text-sm text-gray-500">Quotes for parts sales — non-tax documents that can be converted to a real invoice once accepted.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/invoices"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Invoices
          </Link>
          <Link
            href="/invoices/new-parts-sale"
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            + New parts sale
          </Link>
        </div>
      </div>

      <div className="mb-3 relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by proforma number or customer name…"
          className="block w-full rounded-md border border-gray-300 ps-9 pe-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setStatusFilter(tab); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              statusFilter === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Number</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Issued</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Valid until</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white text-sm">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/proformas/${p.id}`} className="font-medium text-primary-600 hover:underline">
                          {p.proforma_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.customer?.full_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(p.status)}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(p.issue_date)}</td>
                      <td className="px-4 py-3 text-gray-700">{p.valid_until ? formatDate(p.valid_until) : '—'}</td>
                      <td className="px-4 py-3 text-end font-medium text-gray-900">{formatCurrency(p.grand_total)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon="estimates"
                        title="No proformas yet"
                        description="Create a parts sale and pick 'Proforma' as the output to generate a quote."
                      />
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
                Previous
              </button>
              <span className="text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
