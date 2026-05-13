'use client';

import { Link } from '@/i18n/navigation';
import { useInvoices } from '@/hooks/use-invoices';
import { useProformas } from '@/hooks/use-proformas';
import { formatCurrency, formatDate } from '@/lib/format';
import { Receipt, FileText, Plus, ArrowRight } from 'lucide-react';
import { InventoryTabs } from '../inventory-tabs';

function invoiceStatusBadge(status: string): string {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    partial: 'bg-amber-100 text-amber-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

function proformaStatusBadge(status: string): string {
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

export default function PartsSaleHubPage() {
  // Pull recent invoices + filter to ones without a job_card (= OTC sales)
  const { data: invoicesData, isLoading: invLoading } = useInvoices(1);
  const recentOtcInvoices = (invoicesData?.data ?? [])
    .filter((i) => i.job_card_id == null)
    .slice(0, 5);

  const { data: proformasData, isLoading: proLoading } = useProformas(1);
  const recentProformas = (proformasData?.data ?? []).slice(0, 5);

  return (
    <div>
      <InventoryTabs />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Parts Sale</h1>
          <p className="mt-1 text-sm text-gray-500">
            Over-the-counter parts sales — no job card, no vehicle. Issue an invoice (FT) or a proforma quote in a few clicks.
          </p>
        </div>
        <Link
          href="/invoices/new-parts-sale"
          className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          New parts sale
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent OTC invoices */}
        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-900">Recent OTC invoices</h2>
            </div>
            <Link href="/invoices" className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
              All invoices <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {invLoading ? (
            <div className="px-4 py-6 text-sm text-gray-500">Loading…</div>
          ) : recentOtcInvoices.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No stand-alone invoices yet.{' '}
              <Link href="/invoices/new-parts-sale" className="font-medium text-primary-600 hover:underline">
                Create the first one →
              </Link>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Number</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th className="text-end">Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {recentOtcInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={`/invoices/${inv.id}`} className="font-medium text-primary-600 hover:underline">
                        {inv.invoice_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{inv.customer?.full_name ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${invoiceStatusBadge(inv.status)}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-end font-medium text-gray-900">{formatCurrency(inv.grand_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Recent proformas */}
        <section className="rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-900">Recent proformas</h2>
            </div>
            <Link href="/proformas" className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
              All proformas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {proLoading ? (
            <div className="px-4 py-6 text-sm text-gray-500">Loading…</div>
          ) : recentProformas.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-500">
              No proformas yet.{' '}
              <Link href="/invoices/new-parts-sale" className="font-medium text-primary-600 hover:underline">
                Create one →
              </Link>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>Number</Th>
                  <Th>Customer</Th>
                  <Th>Status</Th>
                  <Th>Issued</Th>
                  <Th className="text-end">Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {recentProformas.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={`/proformas/${p.id}`} className="font-medium text-primary-600 hover:underline">
                        {p.proforma_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{p.customer?.full_name ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${proformaStatusBadge(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{formatDate(p.issue_date)}</td>
                    <td className="px-3 py-2 text-end font-medium text-gray-900">{formatCurrency(p.grand_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500 ${className}`}>{children}</th>;
}
