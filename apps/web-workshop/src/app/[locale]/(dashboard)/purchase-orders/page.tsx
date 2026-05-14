'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { usePurchaseOrders, useCreatePurchaseOrder, useVendors } from '@/hooks/use-purchases';
import {
  useParts,
  useVehicleMakes,
  useVehicleModels,
  useResolveVehicle,
  useVehiclePlates,
  useJobNumbers,
  type PartPurchaseHistory,
  type PartPurchaseHistoryRow,
} from '@/hooks/use-parts';
import * as XLSX from 'xlsx';
import { api } from '@/lib/api';
import { useToast } from '@mecanix/ui-web';
import { formatCurrency, formatDate } from '@/lib/format';
import { downloadXlsx } from '@/lib/csv';
import { SearchableSelect } from '@/components/SearchableSelect';
import { InventoryTabs } from '../parts/inventory-tabs';

const FALLBACK_MAKES = ['Toyota', 'Nissan', 'Mitsubishi', 'Honda', 'Hyundai', 'Kia', 'Ford', 'Volkswagen', 'BMW', 'Mercedes'];

const STATUS_TABS = ['all', 'draft', 'sent', 'partial', 'complete'] as const;

function safe(val: unknown): number {
  return typeof val === 'number' ? val : Number(val) || 0;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    partial: 'bg-yellow-100 text-yellow-700',
    complete: 'bg-green-100 text-green-700',
  };
  return map[status] ?? 'bg-gray-100 text-gray-600';
}

export default function PurchaseOrdersPage() {
  const t = useTranslations('purchases');
  const tc = useTranslations('common');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = usePurchaseOrders(
    page,
    undefined,
    statusFilter === 'all' ? undefined : statusFilter,
  );
  const { data: vendorsData } = useVendors();
  const createMutation = useCreatePurchaseOrder();

  // Vehicle filter for the parts picker. `vehicleScope` is what we actually
  // pass to /parts; the other state fields are just user input that resolves
  // into a scope (directly or via plate/job-card lookup).
  const [filterMake, setFilterMake] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterPlate, setFilterPlate] = useState('');
  const [filterJobNumber, setFilterJobNumber] = useState('');
  const [filterError, setFilterError] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);

  const vehicleScope = filterMake
    ? {
        make: filterMake,
        model: filterModel || undefined,
        year: filterYear ? Number(filterYear) : undefined,
      }
    : undefined;

  const { data: vehicleMakes } = useVehicleMakes();
  const { data: vehicleModels } = useVehicleModels(filterMake || undefined);
  const { data: plates } = useVehiclePlates();
  const { data: jobNumbers } = useJobNumbers();
  const resolveVehicle = useResolveVehicle();
  const { data: partsData } = useParts(1, '', undefined, vehicleScope);

  // Year combobox source: 1990 → next year.
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const out: string[] = [];
    for (let y = current + 1; y >= 1990; y--) out.push(String(y));
    return out;
  }, []);

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const toast = useToast();
  const [form, setForm] = useState({
    vendorId: '',
    expectedDate: '',
    notes: '',
    lines: [{ partId: '', description: '', quantity: 1, unitCost: 0 }],
  });
  // Last-purchase hints per line index — surfaces under each line after
  // the user picks a part, so they can see where the prefilled price came
  // from without opening a modal.
  const [lineHints, setLineHints] = useState<Record<number, PartPurchaseHistoryRow | null>>({});

  const addLine = () => {
    setForm({
      ...form,
      lines: [...form.lines, { partId: '', description: '', quantity: 1, unitCost: 0 }],
    });
  };

  const updateLine = (idx: number, field: keyof typeof form.lines[number], value: string | number) => {
    const lines = [...form.lines];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (lines[idx] as any) = { ...lines[idx], [field]: value };
    setForm({ ...form, lines });
  };

  const removeLine = (idx: number) => {
    setForm({ ...form, lines: form.lines.filter((_, i) => i !== idx) });
    setLineHints((prev) => {
      const next: Record<number, PartPurchaseHistoryRow | null> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < idx) next[i] = v;
        else if (i > idx) next[i - 1] = v;
      });
      return next;
    });
  };

  const downloadImportTemplate = () => {
    downloadXlsx(
      'po-lines-template',
      [
        ['part_number', 'description', 'quantity', 'unit_cost'],
        ['ABC-001', 'Brake pads — front', 10, 25.50],
        ['XYZ-200', 'Oil filter', 25, 4.80],
        ['', 'Description-only line (no catalogue match)', 1, 100],
      ],
      'PO lines',
    );
  };

  const handleImportLines = async (file: File | undefined) => {
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]!];
      if (!ws) {
        toast.error('Empty workbook');
        return;
      }
      type Row = { part_number?: string; description?: string; quantity?: number | string; unit_cost?: number | string };
      const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: '' });
      if (rows.length === 0) {
        toast.error('No rows found in the file');
        return;
      }

      // Resolve part_ids by part_number against the catalogue
      const wantedNumbers = rows
        .map((r) => String(r.part_number ?? '').trim())
        .filter((n) => n.length > 0);
      const partByNumber = new Map<string, { id: string; description: string; unit_cost: number }>();
      for (const p of parts) {
        if (p.part_number) {
          partByNumber.set(p.part_number, {
            id: p.id,
            description: p.description,
            unit_cost: Number(p.unit_cost ?? 0),
          });
        }
      }

      const newLines = rows.map((r) => {
        const pn = String(r.part_number ?? '').trim();
        const hit = pn ? partByNumber.get(pn) : undefined;
        const qty = Number(r.quantity ?? 1) || 1;
        const cost = Number(r.unit_cost ?? hit?.unit_cost ?? 0) || 0;
        const desc = String(r.description ?? '').trim() || hit?.description || pn || '—';
        return {
          partId: hit?.id ?? '',
          description: desc,
          quantity: qty,
          unitCost: cost,
        };
      });

      setForm((f) => ({ ...f, lines: newLines }));
      setLineHints({});
      const matched = newLines.filter((l) => l.partId).length;
      toast.success(`Imported ${newLines.length} line${newLines.length === 1 ? '' : 's'} (${matched} matched to catalogue, ${wantedNumbers.length - matched} unmatched)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to read file');
    }
  };

  const handleLinePartChange = async (idx: number, partId: string) => {
    const p = parts.find((pt) => pt.id === partId);
    const lines = [...form.lines];
    const current = lines[idx] ?? { partId: '', description: '', quantity: 1, unitCost: 0 };
    lines[idx] = {
      ...current,
      partId,
      description: p ? p.description : current.description,
      // Fall back to catalogue cost while we fetch the last purchase below.
      unitCost: p ? p.unit_cost : current.unitCost,
    };
    setForm((f) => ({ ...f, lines }));
    setLineHints((h) => ({ ...h, [idx]: null }));

    if (!partId) return;

    try {
      const history = await api.get<PartPurchaseHistory>(`/parts/${partId}/purchase-history`);
      const last = history.last;
      if (last && last.unit_cost > 0) {
        setForm((f) => {
          const next = [...f.lines];
          const cur = next[idx];
          if (!cur || cur.partId !== partId) return f;
          next[idx] = { ...cur, unitCost: last.unit_cost };
          return { ...f, lines: next };
        });
        setLineHints((h) => ({ ...h, [idx]: last }));
        toast.success(
          `Last bought from ${last.vendor_name ?? '—'} on ${formatDate(last.order_date)} at ${formatCurrency(last.unit_cost)}`,
        );
      }
    } catch {
      // Non-fatal: leave the catalogue price in place.
    }
  };

  const resetVehicleFilter = () => {
    setFilterMake('');
    setFilterModel('');
    setFilterYear('');
    setFilterPlate('');
    setFilterJobNumber('');
    setFilterError(null);
    setFilterSource(null);
  };

  const applyResolvedVehicle = async (args: { plate?: string; jobNumber?: string }) => {
    setFilterError(null);
    setFilterSource(null);
    try {
      const v = await resolveVehicle.mutateAsync(args);
      if (!v) {
        setFilterError(args.plate ? `No vehicle with plate "${args.plate}"` : `No job card "${args.jobNumber}"`);
        return;
      }
      setFilterMake(v.make ?? '');
      setFilterModel(v.model ?? '');
      setFilterYear(v.year ? String(v.year) : '');
      setFilterSource(v.source);
    } catch (err) {
      setFilterError(err instanceof Error ? err.message : 'Lookup failed');
    }
  };

  const handleCreate = async () => {
    try {
      setFormError(null);
      await createMutation.mutateAsync({
        vendorId: form.vendorId,
        expectedDate: form.expectedDate || undefined,
        notes: form.notes || undefined,
        lines: form.lines.map((l) => ({
          partId: l.partId,
          description: l.description,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost),
        })),
      });
      setShowModal(false);
      setForm({ vendorId: '', expectedDate: '', notes: '', lines: [{ partId: '', description: '', quantity: 1, unitCost: 0 }] });
      setSuccessMsg('Saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create purchase order');
    }
  };

  const vendors = Array.isArray(vendorsData) ? vendorsData : (vendorsData?.data ?? []);
  const parts = partsData?.data ?? [];

  return (
    <div>
      <InventoryTabs />
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('poTitle')}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('newPO')}
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Status tabs */}
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setStatusFilter(tab); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              statusFilter === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'all' ? tc('viewAll') : t(`status_${tab}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-gray-500">{tc('loading')}</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('poNumber')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('vendor')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('orderDate')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('expectedDate')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((po) => {
                    const vendorLabel = (po.vendor as Record<string, unknown> | null)?.name ?? po.vendor_name ?? '-';
                    const total = safe(po.total_amount ?? po.total);
                    return (
                      <tr key={po.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                          <Link href={`/purchase-orders/${po.id}`}>{po.po_number}</Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{vendorLabel as string}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(po.status)}`}>
                            {t(`status_${po.status}`)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{new Date(po.order_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">{total.toFixed(2)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                      {t('noPOs')}
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
              <span className="text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
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

      {/* New PO Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('newPO')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('vendor')}</label>
                  <select
                    value={form.vendorId}
                    onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="">{t('selectVendor')}</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('expectedDate')}</label>
                  <input
                    type="date"
                    value={form.expectedDate}
                    onChange={(e) => setForm({ ...form, expectedDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              {/* Vehicle filter for the parts picker */}
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">
                    Filter parts by vehicle
                  </label>
                  {vehicleScope && (
                    <button
                      type="button"
                      onClick={resetVehicleFilter}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <p className="mb-2 text-xs text-gray-500">
                  Parts marked &ldquo;Fits all vehicles&rdquo; always appear. Leave empty to see every part.
                </p>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  <div>
                    <label className="block text-xs text-gray-500">Make</label>
                    <SearchableSelect
                      value={filterMake}
                      options={(vehicleMakes && vehicleMakes.length > 0) ? vehicleMakes : FALLBACK_MAKES}
                      placeholder="Search make…"
                      onChange={(v) => { setFilterMake(v); setFilterModel(''); }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Model</label>
                    <SearchableSelect
                      value={filterModel}
                      options={vehicleModels ?? []}
                      placeholder={filterMake ? 'Search model…' : 'Pick a make first'}
                      disabled={!filterMake}
                      onChange={setFilterModel}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Year</label>
                    <SearchableSelect
                      value={filterYear}
                      options={yearOptions}
                      placeholder="Search year…"
                      onChange={setFilterYear}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Plate (lookup)</label>
                    <SearchableSelect
                      value={filterPlate}
                      options={plates ?? []}
                      placeholder="Search plate…"
                      onChange={(v) => {
                        setFilterPlate(v);
                        if (v.trim()) applyResolvedVehicle({ plate: v.trim() });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Job card # (lookup)</label>
                    <SearchableSelect
                      value={filterJobNumber}
                      options={jobNumbers ?? []}
                      placeholder="Search job card…"
                      onChange={(v) => {
                        setFilterJobNumber(v);
                        if (v.trim()) applyResolvedVehicle({ jobNumber: v.trim() });
                      }}
                    />
                  </div>
                  <div className="flex items-end text-xs text-gray-500">
                    {resolveVehicle.isPending && <span>Looking up…</span>}
                    {filterSource && !resolveVehicle.isPending && (
                      <span className="text-green-700">Matched via {filterSource}</span>
                    )}
                  </div>
                </div>
                {filterError && (
                  <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">{filterError}</div>
                )}
              </div>

              {/* Lines */}
              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-sm font-medium text-gray-700">{t('lines')}</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={downloadImportTemplate}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900"
                      title="Download xlsx template"
                    >
                      Template
                    </button>
                    <label className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
                      Import Excel
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(e) => e.target.files && handleImportLines(e.target.files[0])}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={addLine}
                      className="text-sm font-medium text-primary-600 hover:text-primary-700"
                    >
                      + {t('addLine')}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {form.lines.map((line, idx) => {
                    const hint = lineHints[idx];
                    return (
                      <div key={idx} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500">{t('part')}</label>
                            <SearchableSelect
                              value={line.partId}
                              options={parts.map((p) => ({
                                value: p.id,
                                label: `${p.part_number ?? '—'} · ${p.description}`,
                              }))}
                              placeholder="Search part…"
                              allowFreeText={false}
                              onChange={(v) => handleLinePartChange(idx, v)}
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500">{t('description')}</label>
                            <input
                              value={line.description}
                              onChange={(e) => updateLine(idx, 'description', e.target.value)}
                              className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div className="w-20">
                            <label className="block text-xs text-gray-500">{t('qty')}</label>
                            <input
                              type="number"
                              value={line.quantity}
                              onChange={(e) => updateLine(idx, 'quantity', Number(e.target.value))}
                              className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          <div className="w-24">
                            <label className="block text-xs text-gray-500">{t('unitCost')}</label>
                            <input
                              type="number"
                              step="0.01"
                              value={line.unitCost}
                              onChange={(e) => updateLine(idx, 'unitCost', Number(e.target.value))}
                              className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            />
                          </div>
                          {form.lines.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="mb-0.5 text-red-500 hover:text-red-700"
                            >
                              &#x2715;
                            </button>
                          )}
                        </div>
                        {hint && (
                          <div className="mt-2 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-800">
                            Last bought from{' '}
                            <span className="font-semibold">{hint.vendor_name ?? '—'}</span>{' '}
                            on {formatDate(hint.order_date)} at{' '}
                            <span className="font-semibold">{formatCurrency(hint.unit_cost)}</span>
                            {hint.received_qty === 0 && (
                              <span className="ms-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                not yet received
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !form.vendorId}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? tc('loading') : tc('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
