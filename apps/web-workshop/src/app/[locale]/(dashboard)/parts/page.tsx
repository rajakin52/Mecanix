'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { useParts, useCreatePart, useLowStock } from '@/hooks/use-parts';
import { useTecDocSearch, useTecDocVehicles } from '@/hooks/use-tecdoc';
import { SkeletonTable, useToast, EmptyState, SortableHeader, sortData, type SortDirection } from '@mecanix/ui-web';
import { InventoryTabs } from './inventory-tabs';

const CATEGORIES = ['Engine', 'Brakes', 'Suspension', 'Electrical', 'Body', 'Filters', 'Fluids', 'Other'];
const MAKES = ['Toyota', 'Nissan', 'Mitsubishi', 'Honda', 'Hyundai', 'Kia', 'Ford', 'Volkswagen', 'BMW', 'Mercedes'];

export default function PartsPage() {
  const t = useTranslations('parts');
  const tc = useTranslations('common');
  const tt = useTranslations('tecdoc');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showTecDoc, setShowTecDoc] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = (field: string, dir: SortDirection) => {
    setSortField(dir ? field : null);
    setSortDir(dir);
  };

  const { data, isLoading, isError, error } = useParts(page, debouncedSearch, category || undefined);
  const { data: lowStockData } = useLowStock();
  const createMutation = useCreatePart();

  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const [form, setForm] = useState({
    partNumber: '',
    description: '',
    category: 'Other',
    stockQty: 0,
    reorderPoint: 5,
    unitCost: 0,
    sellPrice: 0,
    location: '',
    taxCodeId: '',
  });

  interface TaxCodeSummary { id: string; code: string; name: string; rate: number; is_default: boolean; is_active: boolean }
  const { data: taxCodesData } = useQuery({
    queryKey: ['tax-codes'],
    queryFn: () => api.get<TaxCodeSummary[]>('/tax-codes'),
  });
  const taxCodes = (Array.isArray(taxCodesData) ? taxCodesData : []).filter((t) => t.is_active);
  // Pre-select default code whenever the list is loaded
  React.useEffect(() => {
    if (!form.taxCodeId && taxCodes.length > 0) {
      const def = taxCodes.find((t) => t.is_default) ?? taxCodes[0];
      if (def) setForm((f) => ({ ...f, taxCodeId: def.id }));
    }
  }, [taxCodes, form.taxCodeId]);

  // TecDoc state
  const [tdMake, setTdMake] = useState('');
  const [tdModel, setTdModel] = useState('');
  const [tdSearchTriggered, setTdSearchTriggered] = useState(false);
  const [addingPart, setAddingPart] = useState<string | null>(null);

  const { data: tdVehicles } = useTecDocVehicles(tdMake);
  const { data: tdResults, isLoading: tdLoading } = useTecDocSearch(
    tdSearchTriggered ? tdMake : '',
    tdSearchTriggered ? tdModel : '',
  );

  const handleCreate = async () => {
    try {
      setFormError(null);
      await createMutation.mutateAsync({
        partNumber: form.partNumber || undefined,
        description: form.description,
        category: form.category || undefined,
        stockQty: Number(form.stockQty),
        reorderPoint: Number(form.reorderPoint),
        unitCost: Number(form.unitCost),
        sellPrice: Number(form.sellPrice),
        location: form.location || undefined,
        taxCodeId: form.taxCodeId || undefined,
      });
      setShowModal(false);
      setForm({ partNumber: '', description: '', category: 'Other', stockQty: 0, reorderPoint: 5, unitCost: 0, sellPrice: 0, location: '', taxCodeId: '' });
      toast.success('Saved successfully!');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create part');
    }
  };

  const handleAddFromTecDoc = async (part: Record<string, unknown>) => {
    try {
      setAddingPart(part.partNumber as string);
      const avgPrice = (part.avgPrice as number) ?? 0;
      await createMutation.mutateAsync({
        partNumber: part.partNumber as string,
        description: part.description as string,
        category: part.category as string,
        stockQty: 0,
        reorderPoint: 5,
        unitCost: avgPrice / 100,
        sellPrice: (avgPrice * 1.3) / 100,
      });
      toast.success(tt('addedToCatalogue'));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add part');
    } finally {
      setAddingPart(null);
    }
  };

  const handleTdSearch = () => {
    if (tdMake && tdModel) {
      setTdSearchTriggered(true);
    }
  };

  const lowStockCount = lowStockData?.count ?? 0;

  return (
    <div>
      <InventoryTabs />
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          {lowStockCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
              {lowStockCount} {t('lowStock')}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowScanner(true)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            &#128247; Scan Barcode
          </button>
          <button
            onClick={() => { setShowTecDoc(true); setTdSearchTriggered(false); setTdMake(''); setTdModel(''); }}
            className="rounded-md border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-50"
          >
            {tt('lookup')}
          </button>
          <Link
            href="/parts/bulk-import"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Bulk Import
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {t('newPart')}
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">{t('allCategories')}</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Failed to load parts: {error instanceof Error ? error.message : 'unknown error'}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('partNumber')}</th>
                  <SortableHeader label={t('description')} field="description" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <SortableHeader label={t('stock')} field="stock_qty" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <SortableHeader label={t('costPrice')} field="unit_cost" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('sellPrice')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('category')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(() => {
                  const parts = data?.data ?? [];
                  const sorted = sortData(parts, sortField, sortDir);
                  return sorted.length > 0 ? (
                  sorted.map((part) => (
                    <tr key={part.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{part.part_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{part.description}</td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            (part.stock_qty ?? 0) <= (part.reorder_point ?? 0)
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {part.stock_qty ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{(part.unit_cost ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{((part.sell_price as number) ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{part.category as string}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState icon="parts" title="No parts in inventory" description="Add parts manually or search TecDoc" />
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

      {/* New Part Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('newPart')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('partNumber')}</label>
                  <input
                    value={form.partNumber}
                    onChange={(e) => setForm({ ...form, partNumber: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('category')}</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('description')}</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('stock')}</label>
                  <div className="mt-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    0 — Stock is set via supplier invoices
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('reorderPoint')}</label>
                  <input
                    type="number"
                    value={form.reorderPoint}
                    onChange={(e) => setForm({ ...form, reorderPoint: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('costPrice')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.unitCost}
                    onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('sellPrice')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.sellPrice}
                    onChange={(e) => setForm({ ...form, sellPrice: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('location')}</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder={t('locationPlaceholder')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">IVA *</label>
                <select
                  value={form.taxCodeId}
                  onChange={(e) => setForm({ ...form, taxCodeId: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white"
                  required
                >
                  <option value="">—</option>
                  {taxCodes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} — {t.name} ({Number(t.rate).toFixed(0)}%)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? tc('loading') : tc('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TecDoc Lookup Modal */}
      {showTecDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{tt('lookup')}</h2>
              <button onClick={() => setShowTecDoc(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>

            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tt('make')}</label>
                <select
                  value={tdMake}
                  onChange={(e) => { setTdMake(e.target.value); setTdModel(''); setTdSearchTriggered(false); }}
                  className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{tt('selectMake')}</option>
                  {MAKES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tt('model')}</label>
                <select
                  value={tdModel}
                  onChange={(e) => { setTdModel(e.target.value); setTdSearchTriggered(false); }}
                  disabled={!tdMake}
                  className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                >
                  <option value="">{tt('selectModel')}</option>
                  {tdVehicles && (tdVehicles as Array<Record<string, unknown>>).map((v) => (
                    <option key={v.model as string} value={v.model as string}>{v.model as string}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleTdSearch}
                disabled={!tdMake || !tdModel}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {tt('search')}
              </button>
            </div>

            {tdLoading && tdSearchTriggered && (
              <p className="text-sm text-gray-500">{tc('loading')}</p>
            )}

            {tdSearchTriggered && tdResults && (
              <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">{tt('partNumber')}</th>
                      <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">{tt('description')}</th>
                      <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">{tt('brand')}</th>
                      <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">{tt('category')}</th>
                      <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">{tt('avgPrice')}</th>
                      <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {(tdResults as Array<Record<string, unknown>>).length > 0 ? (
                      (tdResults as Array<Record<string, unknown>>).map((part, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm font-medium text-gray-900">{part.partNumber as string}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">{part.description as string}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">{part.brand as string}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{part.category as string}</td>
                          <td className="px-3 py-2 text-end text-sm text-gray-700">
                            {((part.avgPrice as number) / 100).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-end">
                            <button
                              onClick={() => handleAddFromTecDoc(part)}
                              disabled={addingPart === (part.partNumber as string)}
                              className="rounded-md bg-green-600 px-2 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              {addingPart === (part.partNumber as string) ? tc('loading') : tt('addToCatalogue')}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-sm text-gray-500">
                          {tt('noResults')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowTecDoc(false)} className="rounded-md border px-4 py-2 text-sm">
                {tc('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Scan / Enter Barcode</h2>
              <button onClick={() => { setShowScanner(false); setScanResult(null); setScanInput(''); }} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>

            <p className="text-sm text-gray-500 mb-4">Scan a barcode with your device camera, or type/paste the barcode number below.</p>

            <div className="flex gap-2 mb-4">
              <input
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && scanInput.trim()) {
                    setScanning(true);
                    try {
                      const result = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/parts/scan/${encodeURIComponent(scanInput.trim())}`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
                      }).then(r => r.json());
                      setScanResult(result.data ?? result);
                    } catch { setScanResult({ found: false }); }
                    setScanning(false);
                  }
                }}
                placeholder="Enter barcode, EAN, SKU, or part number..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-lg font-mono focus:border-primary-500 focus:outline-none"
                autoFocus
              />
              <button
                onClick={async () => {
                  if (!scanInput.trim()) return;
                  setScanning(true);
                  try {
                    const result = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/parts/scan/${encodeURIComponent(scanInput.trim())}`, {
                      headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
                    }).then(r => r.json());
                    setScanResult(result.data ?? result);
                  } catch { setScanResult({ found: false }); }
                  setScanning(false);
                }}
                disabled={scanning || !scanInput.trim()}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
              >
                {scanning ? '...' : 'Search'}
              </button>
            </div>

            {scanResult && (
              <div className={`rounded-lg border p-4 ${scanResult.found ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                {scanResult.found && scanResult.part ? (
                  <div>
                    <p className="font-bold text-green-900">{(scanResult.part as Record<string, unknown>).description as string}</p>
                    <p className="text-sm text-green-700 mt-1">
                      Part #: {(scanResult.part as Record<string, unknown>).part_number as string}
                      {String((scanResult.part as Record<string, unknown>).barcode || '') && <span className="ms-3">Barcode: {String((scanResult.part as Record<string, unknown>).barcode ?? '')}</span>}
                    </p>
                    <p className="text-sm text-green-700">
                      Stock: {String((scanResult.part as Record<string, unknown>).stock_qty)} |
                      Cost: {Number((scanResult.part as Record<string, unknown>).unit_cost).toFixed(2)} |
                      Sell: {Number((scanResult.part as Record<string, unknown>).sell_price).toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <p className="text-red-700 font-medium">No part found for &ldquo;{scanInput}&rdquo;</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
