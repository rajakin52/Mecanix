'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useWarehouses,
  useInventorySummary,
  useWarehouseStock,
  useCreateWarehouse,
  useUpdateWarehouse,
  useDeleteWarehouse,
  useStockTransfers,
  useCreateTransfer,
  useCompleteTransfer,
  useStockCounts,
  useStockCount,
  useCreateStockCount,
  useUpdateCountLine,
  useApproveCount,
  type Warehouse,
  type StockTransferLine,
  type StockCountLine,
} from '@/hooks/use-warehouse';
import { useParts } from '@/hooks/use-parts';
import { useDebounce } from '@/hooks/use-debounce';
import { InventoryTabs } from '../parts/inventory-tabs';
import {
  SkeletonTable,
  SkeletonCard,
  StatusBadge,
  EmptyState,
  SortableHeader,
  sortData,
  useToast,
  type SortDirection,
} from '@mecanix/ui-web';
import {
  Warehouse as WarehouseIcon,
  ArrowLeftRight,
  ClipboardCheck,
  Package,
  DollarSign,
  AlertTriangle,
  XCircle,
  Star,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronLeft,
} from 'lucide-react';

type Tab = 'warehouses' | 'transfers' | 'counts';

const WAREHOUSE_TYPES = [
  'main',
  'new_stock',
  'scrap',
  'dead_stock',
  'returns',
  'consignment',
] as const;

// ── Main Page ──────────────────────────────────────────────────────────────

export default function WarehousePage() {
  const tc = useTranslations('common');
  const [activeTab, setActiveTab] = useState<Tab>('warehouses');

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'warehouses', label: tc('warehouses'), icon: WarehouseIcon },
    { key: 'transfers', label: tc('transfers'), icon: ArrowLeftRight },
    { key: 'counts', label: tc('stockCounts'), icon: ClipboardCheck },
  ];

  return (
    <div>
      <InventoryTabs />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{tc('warehouse')}</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors ${
                  active
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'warehouses' && <WarehousesTab />}
      {activeTab === 'transfers' && <TransfersTab />}
      {activeTab === 'counts' && <StockCountsTab />}
    </div>
  );
}

// ── Warehouses Tab ─────────────────────────────────────────────────────────

function WarehousesTab() {
  const tc = useTranslations('common');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editWarehouse, setEditWarehouse] = useState<Warehouse | null>(null);
  const [viewStockId, setViewStockId] = useState<string | null>(null);
  const [viewStockName, setViewStockName] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const { data, isLoading } = useWarehouses(page);
  const { data: summary, isLoading: summaryLoading } = useInventorySummary();
  const deleteMutation = useDeleteWarehouse();

  const handleSort = (field: string, dir: SortDirection) => {
    setSortField(dir ? field : null);
    setSortDir(dir);
  };

  const handleDelete = async (wh: Warehouse) => {
    if (!window.confirm(`${tc('delete')} "${wh.name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(wh.id);
      toast.success(tc('deletedSuccessfully'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('error'));
    }
  };

  if (viewStockId) {
    return (
      <WarehouseStockView
        warehouseId={viewStockId}
        warehouseName={viewStockName}
        onBack={() => setViewStockId(null)}
      />
    );
  }

  return (
    <>
      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <SummaryCard
              icon={Package}
              label={tc('totalSKUs')}
              value={summary?.total_skus ?? 0}
              color="text-blue-600 bg-blue-100"
            />
            <SummaryCard
              icon={DollarSign}
              label={tc('totalStockValue')}
              value={(summary?.total_stock_value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              color="text-green-600 bg-green-100"
            />
            <SummaryCard
              icon={AlertTriangle}
              label={tc('lowStockItems')}
              value={summary?.low_stock_count ?? 0}
              color="text-yellow-600 bg-yellow-100"
            />
            <SummaryCard
              icon={XCircle}
              label={tc('outOfStock')}
              value={summary?.out_of_stock_count ?? 0}
              color="text-red-600 bg-red-100"
            />
          </>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{tc('warehouses')}</h2>
        <button
          onClick={() => { setEditWarehouse(null); setShowModal(true); }}
          className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          {tc('newWarehouse')}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={7} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label={tc('name')} field="name" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('code')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('type')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('branch')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">{tc('default')}</th>
                  <SortableHeader label={tc('stockItems')} field="stock_items_count" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(() => {
                  const warehouses = data?.data ?? [];
                  const sorted = sortData(warehouses, sortField, sortDir);
                  return sorted.length > 0 ? (
                    sorted.map((wh) => (
                      <tr
                        key={wh.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => { setViewStockId(wh.id); setViewStockName(wh.name); }}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{wh.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 font-mono">{wh.code}</td>
                        <td className="px-4 py-3 text-sm">
                          <StatusBadge status={wh.type} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{wh.branch_name ?? '-'}</td>
                        <td className="px-4 py-3 text-center">
                          {wh.is_default && <Star className="mx-auto h-4 w-4 fill-yellow-400 text-yellow-400" />}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{wh.stock_items_count}</td>
                        <td className="px-4 py-3 text-end">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => { setViewStockId(wh.id); setViewStockName(wh.name); }}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              title={tc('viewStock')}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => { setEditWarehouse(wh); setShowModal(true); }}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                              title={tc('edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(wh)}
                              className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title={tc('delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          icon={WarehouseIcon}
                          title={tc('noWarehouses')}
                          description={tc('noWarehousesDesc')}
                          action={{ label: tc('newWarehouse'), onClick: () => setShowModal(true) }}
                        />
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">
                {tc('previous')}
              </button>
              <span className="text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.meta.totalPages} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">
                {tc('next')}
              </button>
            </div>
          )}
        </>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <WarehouseModal
          warehouse={editWarehouse}
          onClose={() => { setShowModal(false); setEditWarehouse(null); }}
        />
      )}
    </>
  );
}

// ── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-card">
      <div className="flex items-center gap-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

// ── Warehouse Modal (Create / Edit) ────────────────────────────────────────

function WarehouseModal({ warehouse, onClose }: { warehouse: Warehouse | null; onClose: () => void }) {
  const tc = useTranslations('common');
  const toast = useToast();
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const [formError, setFormError] = useState<string | null>(null);
  const isEdit = !!warehouse;

  const [form, setForm] = useState({
    name: warehouse?.name ?? '',
    code: warehouse?.code ?? '',
    type: warehouse?.type ?? 'main',
    address: warehouse?.address ?? '',
    is_default: warehouse?.is_default ?? false,
    notes: warehouse?.notes ?? '',
  });

  const handleSubmit = async () => {
    setFormError(null);
    if (!form.name.trim()) { setFormError(tc('fieldRequired')); return; }
    if (!form.code.trim()) { setFormError(tc('fieldRequired')); return; }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: warehouse.id, ...form });
      } else {
        await createMutation.mutateAsync(form);
      }
      toast.success(tc('savedSuccessfully'));
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tc('error'));
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? tc('editWarehouse') : tc('newWarehouse')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {formError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{tc('name')} *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{tc('code')} *</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. WH-MAIN"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{tc('type')}</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {WAREHOUSE_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{tc('address')}</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_default"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="is_default" className="text-sm font-medium text-gray-700">{tc('defaultWarehouse')}</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
              {tc('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? tc('loading') : tc('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Warehouse Stock View ───────────────────────────────────────────────────

function WarehouseStockView({ warehouseId, warehouseName, onBack }: { warehouseId: string; warehouseName: string; onBack: () => void }) {
  const tc = useTranslations('common');
  const [stockPage, setStockPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const { data, isLoading } = useWarehouseStock(warehouseId, stockPage);

  const handleSort = (field: string, dir: SortDirection) => {
    setSortField(dir ? field : null);
    setSortDir(dir);
  };

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" />
        {tc('backToWarehouses')}
      </button>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{warehouseName} - {tc('stock')}</h2>

      {isLoading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('partNumber')}</th>
                  <SortableHeader label={tc('description')} field="description" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('category')}</th>
                  <SortableHeader label={tc('quantity')} field="quantity" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('location')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(() => {
                  const stock = data?.data ?? [];
                  const sorted = sortData(stock, sortField, sortDir);
                  return sorted.length > 0 ? (
                    sorted.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.part_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.description}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.category}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.quantity <= 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {item.quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.location ?? '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState icon={Package} title={tc('noStockItems')} description={tc('noStockItemsDesc')} />
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => setStockPage((p) => Math.max(1, p - 1))} disabled={stockPage === 1} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">
                {tc('previous')}
              </button>
              <span className="text-sm text-gray-600">{stockPage} / {data.meta.totalPages}</span>
              <button onClick={() => setStockPage((p) => p + 1)} disabled={stockPage >= data.meta.totalPages} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">
                {tc('next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Transfers Tab ──────────────────────────────────────────────────────────

function TransfersTab() {
  const tc = useTranslations('common');
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useStockTransfers(page);
  const completeMutation = useCompleteTransfer();

  const handleComplete = async (id: string) => {
    if (!window.confirm(tc('confirmCompleteTransfer'))) return;
    try {
      await completeMutation.mutateAsync(id);
      toast.success(tc('transferCompleted'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('error'));
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{tc('transfers')}</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          {tc('newTransfer')}
        </button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('transferNumber')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('fromWarehouse')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('toWarehouse')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('status')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('date')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(data?.data ?? []).length > 0 ? (
                  (data?.data ?? []).map((tr) => (
                    <tr key={tr.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{tr.transfer_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{tr.from_warehouse_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{tr.to_warehouse_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={tr.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(tr.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-end">
                        {tr.status === 'in_transit' && (
                          <button
                            onClick={() => handleComplete(tr.id)}
                            disabled={completeMutation.isPending}
                            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {tc('complete')}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={ArrowLeftRight}
                        title={tc('noTransfers')}
                        description={tc('noTransfersDesc')}
                        action={{ label: tc('newTransfer'), onClick: () => setShowModal(true) }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">
                {tc('previous')}
              </button>
              <span className="text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.meta.totalPages} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">
                {tc('next')}
              </button>
            </div>
          )}
        </>
      )}

      {showModal && <TransferModal onClose={() => setShowModal(false)} />}
    </>
  );
}

// ── Transfer Modal ─────────────────────────────────────────────────────────

interface TransferLineForm {
  part_id: string;
  part_label: string;
  quantity: number;
}

function TransferModal({ onClose }: { onClose: () => void }) {
  const tc = useTranslations('common');
  const toast = useToast();
  const createMutation = useCreateTransfer();
  const [formError, setFormError] = useState<string | null>(null);

  const { data: warehouseData } = useWarehouses(1);
  const warehouses = warehouseData?.data ?? [];

  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TransferLineForm[]>([]);

  // Part search for adding lines
  const [partSearch, setPartSearch] = useState('');
  const debouncedPartSearch = useDebounce(partSearch, 300);
  const { data: partsData } = useParts(1, debouncedPartSearch);

  const addLine = (partId: string, label: string) => {
    if (lines.some((l) => l.part_id === partId)) return;
    setLines([...lines, { part_id: partId, part_label: label, quantity: 1 }]);
    setPartSearch('');
  };

  const updateLineQty = (idx: number, qty: number) => {
    const updated = [...lines];
    updated[idx] = { ...updated[idx], quantity: Math.max(1, qty) };
    setLines(updated);
  };

  const removeLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!fromWarehouseId) { setFormError(tc('selectFromWarehouse')); return; }
    if (!toWarehouseId) { setFormError(tc('selectToWarehouse')); return; }
    if (fromWarehouseId === toWarehouseId) { setFormError(tc('warehousesMustDiffer')); return; }
    if (lines.length === 0) { setFormError(tc('addAtLeastOneLine')); return; }

    try {
      await createMutation.mutateAsync({
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        notes: notes || undefined,
        lines: lines.map((l) => ({ part_id: l.part_id, quantity: l.quantity })),
      });
      toast.success(tc('transferCreated'));
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tc('error'));
    }
  };

  const filteredTo = warehouses.filter((w) => w.id !== fromWarehouseId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tc('newTransfer')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {formError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">{tc('fromWarehouse')} *</label>
              <select
                value={fromWarehouseId}
                onChange={(e) => { setFromWarehouseId(e.target.value); if (toWarehouseId === e.target.value) setToWarehouseId(''); }}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">{tc('selectWarehouse')}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">{tc('toWarehouse')} *</label>
              <select
                value={toWarehouseId}
                onChange={(e) => setToWarehouseId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">{tc('selectWarehouse')}</option>
                {filteredTo.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Add lines */}
          <div>
            <label className="block text-sm font-medium text-gray-700">{tc('addParts')}</label>
            <div className="relative mt-1">
              <input
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                placeholder={tc('searchParts')}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              {partSearch && partsData?.data && partsData.data.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-40 w-full overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {partsData.data.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addLine(p.id, `${p.part_number} - ${p.description}`)}
                      className="block w-full px-3 py-2 text-start text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium">{p.part_number}</span> - {p.description}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lines table */}
          {lines.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">{tc('part')}</th>
                    <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">{tc('quantity')}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {lines.map((line, idx) => (
                    <tr key={line.part_id}>
                      <td className="px-3 py-2 text-gray-700">{line.part_label}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateLineQty(idx, Number(e.target.value))}
                          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-end">
                        <button onClick={() => removeLine(idx)} className="text-gray-400 hover:text-red-500">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
              {tc('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? tc('loading') : tc('createTransfer')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stock Counts Tab ───────────────────────────────────────────────────────

function StockCountsTab() {
  const tc = useTranslations('common');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [viewCountId, setViewCountId] = useState<string | null>(null);

  const { data, isLoading } = useStockCounts(page);

  if (viewCountId) {
    return <StockCountDetail countId={viewCountId} onBack={() => setViewCountId(null)} />;
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{tc('stockCounts')}</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          {tc('newStockCount')}
        </button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('countNumber')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('warehouse')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('status')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('date')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('countedBy')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(data?.data ?? []).length > 0 ? (
                  (data?.data ?? []).map((sc) => (
                    <tr
                      key={sc.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setViewCountId(sc.id)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{sc.count_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{sc.warehouse_name}</td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={sc.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(sc.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{sc.counted_by_name ?? '-'}</td>
                      <td className="px-4 py-3 text-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewCountId(sc.id); }}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title={tc('view')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={ClipboardCheck}
                        title={tc('noStockCounts')}
                        description={tc('noStockCountsDesc')}
                        action={{ label: tc('newStockCount'), onClick: () => setShowModal(true) }}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">
                {tc('previous')}
              </button>
              <span className="text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.meta.totalPages} className="rounded-md border px-3 py-1 text-sm disabled:opacity-50">
                {tc('next')}
              </button>
            </div>
          )}
        </>
      )}

      {showModal && <StockCountModal onClose={() => setShowModal(false)} />}
    </>
  );
}

// ── Stock Count Modal (Create) ─────────────────────────────────────────────

function StockCountModal({ onClose }: { onClose: () => void }) {
  const tc = useTranslations('common');
  const toast = useToast();
  const createMutation = useCreateStockCount();
  const [formError, setFormError] = useState<string | null>(null);

  const { data: warehouseData } = useWarehouses(1);
  const warehouses = warehouseData?.data ?? [];

  const [warehouseId, setWarehouseId] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    setFormError(null);
    if (!warehouseId) { setFormError(tc('selectWarehouse')); return; }

    try {
      await createMutation.mutateAsync({
        warehouse_id: warehouseId,
        category: category || undefined,
        notes: notes || undefined,
      });
      toast.success(tc('stockCountCreated'));
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : tc('error'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{tc('newStockCount')}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {formError && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700">{tc('warehouse')} *</label>
            <select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">{tc('selectWarehouse')}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{tc('categoryFilter')}</label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={tc('optionalCategoryFilter')}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
              {tc('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {createMutation.isPending ? tc('loading') : tc('create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stock Count Detail View ────────────────────────────────────────────────

function StockCountDetail({ countId, onBack }: { countId: string; onBack: () => void }) {
  const tc = useTranslations('common');
  const toast = useToast();
  const { data: count, isLoading } = useStockCount(countId);
  const updateLineMutation = useUpdateCountLine();
  const approveMutation = useApproveCount();

  const [editingLine, setEditingLine] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(0);
  const [editNotes, setEditNotes] = useState('');

  const startEdit = (line: StockCountLine) => {
    setEditingLine(line.id);
    setEditQty(line.counted_qty ?? line.system_qty);
    setEditNotes(line.notes ?? '');
  };

  const saveEdit = async (line: StockCountLine) => {
    try {
      await updateLineMutation.mutateAsync({
        countId,
        lineId: line.id,
        counted_qty: editQty,
        notes: editNotes || undefined,
      });
      setEditingLine(null);
      toast.success(tc('savedSuccessfully'));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('error'));
    }
  };

  const handleApprove = async () => {
    if (!window.confirm(tc('confirmApproveCount'))) return;
    try {
      await approveMutation.mutateAsync(countId);
      toast.success(tc('stockCountApproved'));
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('error'));
    }
  };

  if (isLoading) {
    return (
      <div>
        <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4" />
          {tc('backToStockCounts')}
        </button>
        <SkeletonTable rows={8} cols={6} />
      </div>
    );
  }

  if (!count) {
    return (
      <div>
        <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4" />
          {tc('backToStockCounts')}
        </button>
        <p className="text-sm text-gray-500">{tc('notFound')}</p>
      </div>
    );
  }

  const canEdit = count.status === 'draft' || count.status === 'in_progress';

  return (
    <div>
      <button onClick={onBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ChevronLeft className="h-4 w-4" />
        {tc('backToStockCounts')}
      </button>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{count.count_number}</h2>
          <p className="text-sm text-gray-500">{count.warehouse_name} &middot; <StatusBadge status={count.status} /></p>
        </div>
        {canEdit && (
          <button
            onClick={handleApprove}
            disabled={approveMutation.isPending}
            className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            {approveMutation.isPending ? tc('loading') : tc('approveAndAdjust')}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('partNumber')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('description')}</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('systemQty')}</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('countedQty')}</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('variance')}</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('notes')}</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {(count.lines ?? []).length > 0 ? (
              (count.lines ?? []).map((line) => {
                const isEditing = editingLine === line.id;
                const variance = (line.counted_qty ?? 0) - line.system_qty;
                return (
                  <tr key={line.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{line.part_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{line.description}</td>
                    <td className="px-4 py-3 text-end text-sm text-gray-700">{line.system_qty}</td>
                    <td className="px-4 py-3 text-end text-sm">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editQty}
                          onChange={(e) => setEditQty(Number(e.target.value))}
                          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-end text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                          autoFocus
                        />
                      ) : (
                        <span className="text-gray-700">{line.counted_qty ?? '-'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end text-sm">
                      {line.counted_qty !== null && (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          variance < 0
                            ? 'bg-red-100 text-red-700'
                            : variance > 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {variance > 0 ? '+' : ''}{variance}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {isEditing ? (
                        <input
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder={tc('notes')}
                          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      ) : (
                        line.notes ?? ''
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3 text-end">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => saveEdit(line)}
                              disabled={updateLineMutation.isPending}
                              className="rounded p-1.5 text-green-600 hover:bg-green-50"
                              title={tc('save')}
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingLine(null)}
                              className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
                              title={tc('cancel')}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(line)}
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            title={tc('edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={canEdit ? 7 : 6}>
                  <EmptyState icon={ClipboardCheck} title={tc('noCountLines')} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
