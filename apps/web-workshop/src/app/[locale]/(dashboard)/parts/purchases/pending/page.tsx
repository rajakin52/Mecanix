'use client';

import { Link } from '@/i18n/navigation';
import { InventoryTabs } from '../../inventory-tabs';
import { usePendingDeliveries } from '@/hooks/use-purchase-reports';
import { formatCurrency, formatDate } from '@/lib/format';
import { downloadXlsx } from '@/lib/csv';
import { SkeletonTable } from '@mecanix/ui-web';
import { ChevronLeft } from 'lucide-react';

export default function PendingDeliveriesPage() {
  const { data, isLoading } = usePendingDeliveries();

  const handleExport = () => {
    if (!data) return;
    downloadXlsx(`pending-deliveries-${new Date().toISOString().slice(0, 10)}.csv`, [
      ['PO', 'Status', 'Vendor', 'Order date', 'Expected', 'Overdue', 'Part #', 'Description', 'Ordered', 'Received', 'Outstanding', 'Unit cost', 'Outstanding value'],
      ...data.rows.map((r) => [
        r.po_number, r.po_status, r.vendor_name ?? '', r.order_date, r.expected_date ?? '',
        r.overdue ? 'YES' : 'no', r.part_number ?? '', r.description, r.quantity, r.received_qty,
        r.outstanding, r.unit_cost, r.outstanding_value,
      ]),
    ]);
  };

  return (
    <div>
      <InventoryTabs />
      <div className="mb-4">
        <Link href="/parts/purchases" className="inline-flex items-center text-sm text-primary-600 hover:underline">
          <ChevronLeft className="h-4 w-4" /> Purchases &amp; Reports
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pending Deliveries</h1>
          <p className="text-sm text-gray-500">POs sent or partial with at least one line not fully received. Overdue lines surface first.</p>
        </div>
        <button
          onClick={handleExport}
          disabled={!data}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Export
        </button>
      </div>

      {data && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Kpi label="Lines pending" value={String(data.totals.lines)} />
          <Kpi label="Overdue lines" value={String(data.totals.overdue_lines)} tone={data.totals.overdue_lines > 0 ? 'red' : undefined} />
          <Kpi label="Units outstanding" value={data.totals.outstanding_qty.toLocaleString()} />
          <Kpi label="Value outstanding" value={formatCurrency(data.totals.outstanding_value)} />
        </div>
      )}

      {isLoading ? (
        <SkeletonTable rows={6} cols={10} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <Th>PO</Th><Th>Vendor</Th><Th>Order date</Th><Th>Expected</Th>
                <Th>Part #</Th><Th>Description</Th>
                <Th className="text-end">Ordered</Th><Th className="text-end">Received</Th>
                <Th className="text-end">Outstanding</Th><Th className="text-end">Value</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white text-sm">
              {data && data.rows.length > 0 ? (
                data.rows.map((r, i) => (
                  <tr key={i} className={`hover:bg-gray-50 ${r.overdue ? 'bg-red-50/40' : ''}`}>
                    <td className="px-3 py-2">
                      <Link href={`/purchase-orders/${r.po_id}`} className="font-medium text-primary-600 hover:underline">{r.po_number}</Link>
                      {r.overdue && <span className="ms-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">overdue</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{r.vendor_name ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{formatDate(r.order_date)}</td>
                    <td className="px-3 py-2 text-gray-700">{r.expected_date ? formatDate(r.expected_date) : '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.part_number ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{r.description}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{r.quantity}</td>
                    <td className="px-3 py-2 text-end text-gray-700">{r.received_qty}</td>
                    <td className="px-3 py-2 text-end font-medium text-gray-900">{r.outstanding}</td>
                    <td className="px-3 py-2 text-end text-gray-900">{formatCurrency(r.outstanding_value)}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500">All POs fully received.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500 ${className}`}>{children}</th>;
}
function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'red' }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone === 'red' ? 'text-red-600' : 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
