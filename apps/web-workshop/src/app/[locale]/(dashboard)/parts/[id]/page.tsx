'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { usePart, usePartPurchaseHistory } from '@/hooks/use-parts';
import { useStockByBranch, useTransferStock } from '@/hooks/use-branches';
import { formatCurrency, formatDate } from '@/lib/format';
import { SkeletonPage, useToast } from '@mecanix/ui-web';

export default function PartDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const toast = useToast();

  const { data: part, isLoading } = usePart(id);
  const { data: stockGroups } = useStockByBranch(id);
  const { data: purchaseHistory } = usePartPurchaseHistory(id);
  const transfer = useTransferStock();

  const [transferOpen, setTransferOpen] = useState(false);
  const [fromWarehouse, setFromWarehouse] = useState<string>('');
  const [toWarehouse, setToWarehouse] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [notes, setNotes] = useState('');

  // Flat list of all warehouses for the dropdowns.
  const allWarehouses = useMemo(() => {
    const out: Array<{ id: string; name: string; code: string; branchName: string; quantity: number }> = [];
    for (const g of stockGroups ?? []) {
      for (const w of g.warehouses) {
        out.push({
          id: w.warehouse_id,
          name: w.warehouse_name,
          code: w.warehouse_code,
          branchName: g.branch_name,
          quantity: w.quantity,
        });
      }
    }
    return out;
  }, [stockGroups]);

  if (isLoading) return <SkeletonPage />;
  if (!part) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Part not found
      </div>
    );
  }

  const p = part as unknown as Record<string, unknown>;
  const totalStock = Number(p.stock_qty ?? 0);
  const reserved = Number(p.reserved_qty ?? 0);
  const available = totalStock - reserved;

  const handleTransfer = async () => {
    if (!fromWarehouse || !toWarehouse || !quantity) {
      return toast.error('Source, destination, and quantity are required');
    }
    if (fromWarehouse === toWarehouse) {
      return toast.error('Source and destination must differ');
    }
    try {
      await transfer.mutateAsync({
        partId: id,
        fromWarehouseId: fromWarehouse,
        toWarehouseId: toWarehouse,
        quantity: Number(quantity),
        notes: notes || undefined,
      });
      toast.success(`Transferred ${quantity} unit${Number(quantity) === 1 ? '' : 's'}`);
      setTransferOpen(false);
      setFromWarehouse('');
      setToWarehouse('');
      setQuantity('1');
      setNotes('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Transfer failed');
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Link href="/parts" className="text-sm text-primary-600 hover:underline">
          &larr; Parts
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{p.description as string}</h1>
          <p className="mt-1 text-sm text-gray-500 font-mono">
            {(p.part_number as string) ?? '—'} · {(p.category as string) ?? 'Uncategorised'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTransferOpen(true)}
            disabled={allWarehouses.length < 2}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            Transfer stock
          </button>
        </div>
      </div>

      {/* Part summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Kpi label="Total stock" value={String(totalStock)} />
        <Kpi label="Reserved" value={String(reserved)} />
        <Kpi label="Available" value={String(available)} color={available <= Number(p.reorder_point ?? 0) ? 'text-red-600' : 'text-gray-900'} />
        <Kpi label="Unit cost" value={formatCurrency(Number(p.unit_cost ?? 0))} />
      </div>

      {/* Stock by branch */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Stock by branch</h2>
            <p className="text-xs text-gray-500">Each branch groups one or more warehouses.</p>
          </div>
        </div>
        {!stockGroups || stockGroups.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No warehouse stock records for this part yet.
          </p>
        ) : (
          <div className="space-y-4">
            {stockGroups.map((g) => (
              <div key={g.branch_id ?? 'unassigned'} className="rounded-md border border-gray-200">
                <div className="flex items-center justify-between border-b px-4 py-2 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {g.branch_name}
                    </span>
                    {g.branch_code ? (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs font-mono text-gray-700">
                        {g.branch_code}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {g.total} unit{g.total === 1 ? '' : 's'}
                  </span>
                </div>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Warehouse</th>
                      <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Bin</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">On hand</th>
                      <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Min</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {g.warehouses.map((w) => (
                      <tr key={w.warehouse_id}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {w.warehouse_name}
                          <span className="ms-2 text-xs text-gray-500 font-mono">{w.warehouse_code}</span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600 font-mono">{w.bin_location ?? '—'}</td>
                        <td className={`px-4 py-2 text-end text-sm font-medium ${w.quantity <= w.min_quantity ? 'text-red-600' : 'text-gray-900'}`}>
                          {w.quantity}
                        </td>
                        <td className="px-4 py-2 text-end text-sm text-gray-500">{w.min_quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Purchase history */}
      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Purchase history</h2>
          {purchaseHistory?.last && (
            <span className="text-xs text-gray-500">
              Last:{' '}
              <span className="font-medium text-gray-700">
                {purchaseHistory.last.vendor_name ?? '—'}
              </span>{' '}
              · {formatDate(purchaseHistory.last.order_date)} ·{' '}
              {formatCurrency(purchaseHistory.last.unit_cost)}
            </span>
          )}
        </div>
        {!purchaseHistory || purchaseHistory.history.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            This part has never been ordered yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Supplier</th>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">PO</th>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Order date</th>
                  <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Qty</th>
                  <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Received</th>
                  <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Unit price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {purchaseHistory.history.map((row) => (
                  <tr key={row.po_line_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">{row.vendor_name ?? '—'}</td>
                    <td className="px-4 py-2 text-sm">
                      <Link
                        href={`/purchase-orders/${row.po_id}`}
                        className="font-medium text-primary-600 hover:underline"
                      >
                        {row.po_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{formatDate(row.order_date)}</td>
                    <td className="px-4 py-2 text-end text-sm text-gray-700">{row.quantity}</td>
                    <td className={`px-4 py-2 text-end text-sm ${row.received_qty < row.quantity ? 'text-amber-700' : 'text-green-700'}`}>
                      {row.received_qty}
                    </td>
                    <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">
                      {formatCurrency(row.unit_cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-3">Part details</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Row label="Sell price" value={formatCurrency(Number(p.sell_price ?? 0))} />
          <Row label="Reorder point" value={String(p.reorder_point ?? 0)} />
          {p.default_warranty_months != null ? (
            <Row label="Default warranty" value={`${p.default_warranty_months} months`} />
          ) : null}
          {p.created_at ? <Row label="Created" value={formatDate(p.created_at as string)} /> : null}
        </dl>
      </div>

      {/* Transfer modal */}
      {transferOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Transfer stock</h2>
              <button onClick={() => setTransferOpen(false)} className="text-gray-400 hover:text-gray-600">
                &#x2715;
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">From warehouse</label>
                <select
                  value={fromWarehouse}
                  onChange={(e) => setFromWarehouse(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select source…</option>
                  {allWarehouses.filter((w) => w.quantity > 0).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.branchName} — {w.name} ({w.quantity} on hand)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">To warehouse</label>
                <select
                  value={toWarehouse}
                  onChange={(e) => setToWarehouse(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Select destination…</option>
                  {allWarehouses.filter((w) => w.id !== fromWarehouse).map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.branchName} — {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. moved for Luanda pickup job"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setTransferOpen(false)} className="rounded-md border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={transfer.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {transfer.isPending ? 'Transferring…' : 'Transfer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{value}</dd>
    </div>
  );
}
