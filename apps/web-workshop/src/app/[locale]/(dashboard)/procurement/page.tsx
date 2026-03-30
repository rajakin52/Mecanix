'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  usePartsRequests,
  useCreatePartsRequest,
  useStartPicking,
  useMarkItemPicked,
  useMarkItemUnavailable,
  useMarkReady,
  useIssueParts,
  useCancelPartsRequest,
  type PartsRequest,
  type PartsRequestStatus,
  type PartsRequestItem,
} from '@/hooks/use-parts-requests';
import {
  usePurchaseRequests,
  useCreatePurchaseRequest,
  useApprovePurchaseRequest,
  useRejectPurchaseRequest,
  useLinkPO,
  useMarkPRReceived,
  type PurchaseRequest,
  type PurchaseRequestStatus,
} from '@/hooks/use-purchase-requests';
import { useJobs } from '@/hooks/use-jobs';
import { useParts } from '@/hooks/use-parts';
import { useDebounce } from '@/hooks/use-debounce';
import { InventoryTabs } from '../parts/inventory-tabs';
import {
  SkeletonTable,
  StatusBadge,
  EmptyState,
  useToast,
} from '@mecanix/ui-web';
import {
  ClipboardList,
  ShoppingCart,
  PackageCheck,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  Search,
  Trash2,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  PackageOpen,
} from 'lucide-react';

type MainTab = 'parts-requests' | 'purchase-requests' | 'put-away';

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ProcurementPage() {
  const tc = useTranslations('common');
  const [activeTab, setActiveTab] = useState<MainTab>('parts-requests');

  const tabs: { key: MainTab; label: string; icon: React.ElementType }[] = [
    { key: 'parts-requests', label: 'Parts Requests', icon: ClipboardList },
    { key: 'purchase-requests', label: 'Purchase Requests', icon: ShoppingCart },
    { key: 'put-away', label: 'Put-Away Tasks', icon: PackageCheck },
  ];

  return (
    <div>
      <InventoryTabs />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Procurement</h1>
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

      {activeTab === 'parts-requests' && <PartsRequestsTab />}
      {activeTab === 'purchase-requests' && <PurchaseRequestsTab />}
      {activeTab === 'put-away' && <PutAwayTab />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Parts Requests Tab ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

type PRStatusFilter = 'all' | PartsRequestStatus;

function PartsRequestsTab() {
  const tc = useTranslations('common');
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<PRStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const { data, isLoading } = usePartsRequests(
    statusFilter === 'all' ? undefined : statusFilter,
    undefined,
    page,
  );

  const startPickingMut = useStartPicking();
  const markReadyMut = useMarkReady();
  const issuePartsMut = useIssueParts();
  const cancelMut = useCancelPartsRequest();

  const statusTabs: { key: PRStatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'requested', label: 'Requested' },
    { key: 'picking', label: 'Picking' },
    { key: 'ready', label: 'Ready' },
    { key: 'issued', label: 'Issued' },
  ];

  const handleStartPicking = async (id: string) => {
    try {
      await startPickingMut.mutateAsync(id);
      toast.success('Picking started');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('tryAgain'));
    }
  };

  const handleMarkReady = async (id: string) => {
    try {
      await markReadyMut.mutateAsync(id);
      toast.success('Marked as ready');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('tryAgain'));
    }
  };

  const handleIssueParts = async (id: string) => {
    try {
      await issuePartsMut.mutateAsync(id);
      toast.success('Parts issued');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('tryAgain'));
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this parts request?')) return;
    try {
      await cancelMut.mutateAsync(id);
      toast.success('Request cancelled');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('tryAgain'));
    }
  };

  const requests = data?.data ?? [];

  return (
    <>
      {/* Status filter tabs */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setStatusFilter(tab.key); setPage(1); }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          New Request
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={8} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No parts requests"
          description="Parts requests from job cards will appear here."
          action={{ label: 'New Request', onClick: () => setShowNewModal(true) }}
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8 px-3 py-3" />
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Request #</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Job Card</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Requested By</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Priority</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Items</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {requests.map((req) => {
                  const isExpanded = expandedId === req.id;
                  return (
                    <PartsRequestRow
                      key={req.id}
                      request={req}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedId(isExpanded ? null : req.id)}
                      onStartPicking={() => handleStartPicking(req.id)}
                      onMarkReady={() => handleMarkReady(req.id)}
                      onIssueParts={() => handleIssueParts(req.id)}
                      onCancel={() => handleCancel(req.id)}
                    />
                  );
                })}
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

      {/* New Request Modal */}
      {showNewModal && (
        <NewPartsRequestModal onClose={() => setShowNewModal(false)} />
      )}
    </>
  );
}

// ── Parts Request Row (expandable) ────────────────────────────────────────

function PartsRequestRow({
  request,
  isExpanded,
  onToggle,
  onStartPicking,
  onMarkReady,
  onIssueParts,
  onCancel,
}: {
  request: PartsRequest;
  isExpanded: boolean;
  onToggle: () => void;
  onStartPicking: () => void;
  onMarkReady: () => void;
  onIssueParts: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <tr className="cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <td className="px-3 py-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900 font-mono">{request.request_number}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{request.job_card_number}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{request.requested_by_name}</td>
        <td className="px-4 py-3 text-sm">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
            request.priority === 'urgent'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-600'
          }`}>
            {request.priority === 'urgent' && <AlertTriangle className="mr-1 h-3 w-3" />}
            {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
          </span>
        </td>
        <td className="px-4 py-3 text-center text-sm text-gray-700">{request.items?.length ?? 0}</td>
        <td className="px-4 py-3 text-sm">
          <StatusBadge status={request.status} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{new Date(request.created_at).toLocaleDateString()}</td>
        <td className="px-4 py-3 text-end">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {request.status === 'requested' && (
              <button
                onClick={onStartPicking}
                className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                Start Picking
              </button>
            )}
            {request.status === 'ready' && (
              <button
                onClick={onIssueParts}
                className="rounded-md bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
              >
                Issue Parts
              </button>
            )}
            {(request.status === 'requested' || request.status === 'picking') && (
              <button
                onClick={onCancel}
                className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded item detail */}
      {isExpanded && (
        <tr>
          <td colSpan={9} className="bg-gray-50 px-8 py-4">
            <PickingItemsList
              request={request}
              onMarkReady={onMarkReady}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ── Picking Items List ────────────────────────────────────────────────────

function PickingItemsList({
  request,
  onMarkReady,
}: {
  request: PartsRequest;
  onMarkReady: () => void;
}) {
  const toast = useToast();
  const markPickedMut = useMarkItemPicked();
  const markUnavailMut = useMarkItemUnavailable();

  const isPicking = request.status === 'picking';
  const items = request.items ?? [];
  const allResolved = items.length > 0 && items.every((i) => i.status === 'picked' || i.status === 'unavailable');

  const handlePicked = async (item: PartsRequestItem) => {
    try {
      await markPickedMut.mutateAsync({
        requestId: request.id,
        itemId: item.id,
        quantity_picked: item.quantity_requested,
      });
      toast.success(`${item.part_number} picked`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleUnavailable = async (item: PartsRequestItem) => {
    try {
      await markUnavailMut.mutateAsync({
        requestId: request.id,
        itemId: item.id,
      });
      toast.success(`${item.part_number} marked unavailable`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Items</h4>
        {isPicking && allResolved && (
          <button
            onClick={onMarkReady}
            className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark Ready
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-white">
            <tr>
              <th className="px-3 py-2 text-start text-xs font-semibold text-gray-500">Part #</th>
              <th className="px-3 py-2 text-start text-xs font-semibold text-gray-500">Description</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Qty Requested</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Qty Picked</th>
              <th className="px-3 py-2 text-start text-xs font-semibold text-gray-500">Status</th>
              {isPicking && (
                <th className="px-3 py-2 text-end text-xs font-semibold text-gray-500">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-sm font-mono text-gray-900">{item.part_number}</td>
                <td className="px-3 py-2 text-sm text-gray-700">{item.description}</td>
                <td className="px-3 py-2 text-center text-sm text-gray-700">{item.quantity_requested}</td>
                <td className="px-3 py-2 text-center text-sm text-gray-700">{item.quantity_picked}</td>
                <td className="px-3 py-2 text-sm">
                  <ItemStatusBadge status={item.status} />
                </td>
                {isPicking && (
                  <td className="px-3 py-2 text-end">
                    {item.status === 'pending' && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handlePicked(item)}
                          className="rounded p-1 text-green-600 hover:bg-green-50"
                          title="Mark picked"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleUnavailable(item)}
                          className="rounded p-1 text-red-500 hover:bg-red-50"
                          title="Mark unavailable"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {request.notes && (
        <p className="mt-2 text-xs text-gray-500">
          <span className="font-medium">Notes:</span> {request.notes}
        </p>
      )}
    </div>
  );
}

function ItemStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    picked: 'bg-green-100 text-green-700',
    unavailable: 'bg-red-100 text-red-700',
  };
  const icons: Record<string, React.ElementType> = {
    pending: Clock,
    picked: Check,
    unavailable: XCircle,
  };
  const Icon = icons[status] ?? Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── New Parts Request Modal ───────────────────────────────────────────────

function NewPartsRequestModal({ onClose }: { onClose: () => void }) {
  const tc = useTranslations('common');
  const toast = useToast();
  const createMut = useCreatePartsRequest();

  const [jobCardId, setJobCardId] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<{ part_id: string; part_number: string; description: string; quantity: number }[]>([]);
  const [partSearch, setPartSearch] = useState('');
  const debouncedPartSearch = useDebounce(partSearch, 300);

  // Jobs dropdown
  const { data: jobsData } = useJobs(1, '', 'in_progress');
  const jobs = jobsData?.data ?? [];

  // Parts search
  const { data: partsData } = useParts(1, debouncedPartSearch);
  const parts = partsData?.data ?? [];

  const addItem = (part: { id: string; part_number: string; description: string }) => {
    if (items.some((i) => i.part_id === part.id)) return;
    setItems([...items, { part_id: part.id, part_number: part.part_number, description: part.description, quantity: 1 }]);
    setPartSearch('');
  };

  const updateQty = (idx: number, qty: number) => {
    const next = [...items];
    const item = next[idx];
    if (item) item.quantity = Math.max(1, qty);
    setItems(next);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!jobCardId) { toast.error('Select a job card'); return; }
    if (items.length === 0) { toast.error('Add at least one part'); return; }
    try {
      await createMut.mutateAsync({
        job_card_id: jobCardId,
        priority,
        notes: notes || undefined,
        items: items.map((i) => ({
          part_id: i.part_id,
          quantity_requested: i.quantity,
        })),
      });
      toast.success('Parts request created');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('tryAgain'));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-2xl rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">New Parts Request</h3>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-4">
          {/* Job Card select */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Job Card</label>
            <select
              value={jobCardId}
              onChange={(e) => setJobCardId(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Select job card...</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.job_number} - {j.vehicles?.plate ?? ''} {j.vehicles?.make ?? ''} {j.vehicles?.model ?? ''}
                </option>
              ))}
            </select>
          </div>

          {/* Priority toggle */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPriority('normal')}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  priority === 'normal'
                    ? 'bg-gray-800 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setPriority('urgent')}
                className={`flex items-center gap-1 rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  priority === 'urgent'
                    ? 'bg-red-600 text-white'
                    : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Urgent
              </button>
            </div>
          </div>

          {/* Add parts */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Parts</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                placeholder="Search parts by number or description..."
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
            </div>
            {partSearch && parts.length > 0 && (
              <div className="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
                {parts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addItem(p)}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    <span>
                      <span className="font-mono text-gray-900">{p.part_number}</span>
                      <span className="ml-2 text-gray-500">{p.description}</span>
                    </span>
                    <Plus className="h-4 w-4 text-primary-600" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected items */}
          {items.length > 0 && (
            <div className="overflow-hidden rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-start text-xs font-semibold text-gray-500">Part</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Qty</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {items.map((item, idx) => (
                    <tr key={item.part_id}>
                      <td className="px-3 py-2 text-sm">
                        <span className="font-mono text-gray-900">{item.part_number}</span>
                        <span className="ml-2 text-gray-500">{item.description}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateQty(idx, parseInt(e.target.value) || 1)}
                          className="w-16 rounded-md border border-gray-300 px-2 py-1 text-center text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeItem(idx)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Old part photo */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Old Part Photo (optional)</label>
            <div className="flex items-center justify-center rounded-md border-2 border-dashed border-gray-300 px-6 py-8 text-center hover:border-gray-400">
              <div>
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Drag & drop or click to upload</p>
                <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              placeholder="Any special instructions..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {tc('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={createMut.isPending}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {createMut.isPending ? tc('loading') : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Purchase Requests Tab ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

type PRStatusFilterPurchase = 'all' | PurchaseRequestStatus;

function PurchaseRequestsTab() {
  const tc = useTranslations('common');
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState<PRStatusFilterPurchase>('all');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [poIdToLink, setPoIdToLink] = useState('');

  const { data, isLoading } = usePurchaseRequests(
    statusFilter === 'all' ? undefined : statusFilter,
    page,
  );

  const approveMut = useApprovePurchaseRequest();
  const rejectMut = useRejectPurchaseRequest();
  const linkPOMut = useLinkPO();
  const receiveMut = useMarkPRReceived();

  const statusTabs: { key: PRStatusFilterPurchase; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending_approval', label: 'Pending Approval' },
    { key: 'approved', label: 'Approved' },
    { key: 'ordered', label: 'Ordered' },
    { key: 'received', label: 'Received' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const handleApprove = async (id: string) => {
    try {
      await approveMut.mutateAsync(id);
      toast.success('Purchase request approved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('tryAgain'));
    }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    try {
      await rejectMut.mutateAsync({ id: rejectingId, reason: rejectReason || undefined });
      toast.success('Purchase request rejected');
      setRejectingId(null);
      setRejectReason('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('tryAgain'));
    }
  };

  const handleLinkPO = async () => {
    if (!linkingId || !poIdToLink) return;
    try {
      await linkPOMut.mutateAsync({ id: linkingId, po_id: poIdToLink });
      toast.success('Linked to purchase order');
      setLinkingId(null);
      setPoIdToLink('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('tryAgain'));
    }
  };

  const handleReceived = async (id: string) => {
    try {
      await receiveMut.mutateAsync(id);
      toast.success('Purchase request marked as received');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tc('tryAgain'));
    }
  };

  const requests = data?.data ?? [];

  return (
    <>
      {/* Status filter tabs */}
      <div className="mb-4 flex gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <SkeletonTable rows={5} cols={7} />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No purchase requests"
          description="Purchase requests for unavailable parts will appear here."
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-8 px-3 py-3" />
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">PR #</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Job Card</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Items</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Est. Cost</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {requests.map((req) => {
                  const isExpanded = expandedId === req.id;
                  return (
                    <PurchaseRequestRow
                      key={req.id}
                      request={req}
                      isExpanded={isExpanded}
                      onToggle={() => setExpandedId(isExpanded ? null : req.id)}
                      onApprove={() => handleApprove(req.id)}
                      onReject={() => setRejectingId(req.id)}
                      onLinkPO={() => setLinkingId(req.id)}
                      onReceived={() => handleReceived(req.id)}
                    />
                  );
                })}
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

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRejectingId(null)}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Reject Purchase Request</h3>
              <button onClick={() => setRejectingId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Reason (optional)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                placeholder="Why is this being rejected?"
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <button onClick={() => setRejectingId(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                {tc('cancel')}
              </button>
              <button
                onClick={handleReject}
                disabled={rejectMut.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Link PO modal */}
      {linkingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setLinkingId(null)}>
          <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Link to Purchase Order</h3>
              <button onClick={() => setLinkingId(null)} className="rounded p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Purchase Order ID</label>
              <input
                type="text"
                value={poIdToLink}
                onChange={(e) => setPoIdToLink(e.target.value)}
                placeholder="Enter PO ID or select..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              />
              <p className="mt-1 text-xs text-gray-400">Enter the PO ID to link this purchase request.</p>
            </div>
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <button onClick={() => setLinkingId(null)} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                {tc('cancel')}
              </button>
              <button
                onClick={handleLinkPO}
                disabled={!poIdToLink || linkPOMut.isPending}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Link PO
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Purchase Request Row (expandable) ─────────────────────────────────────

function PurchaseRequestRow({
  request,
  isExpanded,
  onToggle,
  onApprove,
  onReject,
  onLinkPO,
  onReceived,
}: {
  request: PurchaseRequest;
  isExpanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onLinkPO: () => void;
  onReceived: () => void;
}) {
  return (
    <>
      <tr className="cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <td className="px-3 py-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900 font-mono">{request.pr_number}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{request.job_card_number ?? '-'}</td>
        <td className="px-4 py-3 text-center text-sm text-gray-700">{request.items?.length ?? 0}</td>
        <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
          {request.estimated_total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </td>
        <td className="px-4 py-3 text-sm">
          <StatusBadge status={request.status} />
        </td>
        <td className="px-4 py-3 text-sm text-gray-500">{new Date(request.created_at).toLocaleDateString()}</td>
        <td className="px-4 py-3 text-end">
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {request.status === 'pending_approval' && (
              <>
                <button
                  onClick={onApprove}
                  className="rounded-md bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                >
                  Approve
                </button>
                <button
                  onClick={onReject}
                  className="rounded-md bg-red-50 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                >
                  Reject
                </button>
              </>
            )}
            {request.status === 'approved' && (
              <button
                onClick={onLinkPO}
                className="rounded-md bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                Link to PO
              </button>
            )}
            {request.status === 'ordered' && (
              <button
                onClick={onReceived}
                className="rounded-md bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
              >
                Mark Received
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="bg-gray-50 px-8 py-4">
            <div className="space-y-3">
              {/* Items table */}
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700">Items</h4>
                <div className="overflow-hidden rounded-md border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white">
                      <tr>
                        <th className="px-3 py-2 text-start text-xs font-semibold text-gray-500">Part #</th>
                        <th className="px-3 py-2 text-start text-xs font-semibold text-gray-500">Description</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-end text-xs font-semibold text-gray-500">Est. Unit Cost</th>
                        <th className="px-3 py-2 text-end text-xs font-semibold text-gray-500">Est. Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {(request.items ?? []).map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 text-sm font-mono text-gray-900">{item.part_number}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">{item.description}</td>
                          <td className="px-3 py-2 text-center text-sm text-gray-700">{item.quantity}</td>
                          <td className="px-3 py-2 text-end text-sm text-gray-700">
                            {item.estimated_unit_cost?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-end text-sm font-medium text-gray-900">
                            {item.estimated_total?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Meta info */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                {request.po_number && (
                  <span>Linked PO: <span className="font-mono font-medium text-gray-700">{request.po_number}</span></span>
                )}
                {request.approved_by_name && (
                  <span>Approved by: <span className="font-medium text-gray-700">{request.approved_by_name}</span></span>
                )}
                {request.rejected_reason && (
                  <span className="text-red-600">Rejection reason: {request.rejected_reason}</span>
                )}
                {request.notes && (
                  <span>Notes: {request.notes}</span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Put-Away Tab (Placeholder) ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

function PutAwayTab() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">Put-Away Tasks</h2>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Coming Soon</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Task #</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Warehouse</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">PO #</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Status</th>
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Items</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Assigned To</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            <tr>
              <td colSpan={6}>
                <EmptyState
                  icon={PackageOpen}
                  title="No put-away tasks"
                  description="Put-away tasks will appear here when goods are received from purchase orders."
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
