'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useDebounce } from '@/hooks/use-debounce';
import { downloadXlsx } from '@/lib/csv';
import { useParts, useCreatePart, useUpdatePart, useLowStock, useVehicleMakes, useVehicleModels, useExportParts, type CataloguePart } from '@/hooks/use-parts';
import { useTecDocSearch, useTecDocVehicles } from '@/hooks/use-tecdoc';
import { SkeletonTable, useToast, EmptyState, SortableHeader, sortData, type SortDirection } from '@mecanix/ui-web';
import { SearchableSelect } from '@/components/SearchableSelect';
import { InventoryTabs } from './inventory-tabs';

const CATEGORIES = ['Engine', 'Brakes', 'Suspension', 'Electrical', 'Body', 'Filters', 'Fluids', 'Other'];
const MAKES = ['Toyota', 'Nissan', 'Mitsubishi', 'Honda', 'Hyundai', 'Kia', 'Ford', 'Volkswagen', 'BMW', 'Mercedes'];

interface CompatRow {
  make: string;
  model: string;
  yearFrom: string;
  yearTo: string;
}

const EMPTY_COMPAT_ROW: CompatRow = { make: '', model: '', yearFrom: '', yearTo: '' };

const UOM_OPTIONS = ['each', 'litre', 'ml', 'kg', 'g', 'metre', 'cm', 'sheet', 'roll', 'pack'];

function UomFields({
  uom, packSize, onUomChange, onPackSizeChange,
}: {
  uom: string;
  packSize: string;
  onUomChange: (v: string) => void;
  onPackSizeChange: (v: string) => void;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-2 text-sm font-medium text-gray-700">Unit of measure</div>
      <p className="mb-2 text-xs text-gray-500">
        How the part is issued to jobs. For things sold in larger containers (e.g. a 5L jug of oil), set <code className="bg-gray-100 px-1 rounded">uom = litre</code> and <code className="bg-gray-100 px-1 rounded">pack size = 5</code>.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500">Unit</label>
          <select
            value={uom}
            onChange={(e) => onUomChange(e.target.value)}
            className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {UOM_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500">Pack size</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={packSize}
            onChange={(e) => onPackSizeChange(e.target.value)}
            className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>
    </div>
  );
}

function CompatibilityEditor({
  isUniversal,
  rows,
  onToggleUniversal,
  onChange,
  makesFallback,
}: {
  isUniversal: boolean;
  rows: CompatRow[];
  onToggleUniversal: (v: boolean) => void;
  onChange: (rows: CompatRow[]) => void;
  makesFallback: string[];
}) {
  const { data: vehicleMakes } = useVehicleMakes();
  const makes = (vehicleMakes && vehicleMakes.length > 0 ? vehicleMakes : makesFallback);

  const update = (idx: number, field: keyof CompatRow, value: string) => {
    const next = [...rows];
    const current = next[idx];
    if (!current) return;
    const merged: CompatRow = { ...current, [field]: value };
    // If user changes make, clear the model so the dependent dropdown re-loads.
    if (field === 'make') merged.model = '';
    next[idx] = merged;
    onChange(next);
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">Vehicle compatibility</label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isUniversal}
            onChange={(e) => onToggleUniversal(e.target.checked)}
          />
          <span>Fits all vehicles</span>
        </label>
      </div>
      {isUniversal ? (
        <p className="text-xs text-gray-500">
          This part will appear in every purchase order regardless of vehicle. Use for batteries, tyres, lubricants, paint, etc.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="text-xs text-gray-500">Add at least one make + model (leave model empty to mean &ldquo;all models of that make&rdquo;).</p>
          )}
          {rows.map((row, idx) => (
            <CompatRowEditor
              key={idx}
              row={row}
              makes={makes}
              onChange={(field, value) => update(idx, field, value)}
              onRemove={() => onChange(rows.filter((_, i) => i !== idx))}
            />
          ))}
          <button
            type="button"
            onClick={() => onChange([...rows, { ...EMPTY_COMPAT_ROW }])}
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            + Add make/model
          </button>
        </div>
      )}
    </div>
  );
}

function CompatRowEditor({
  row,
  makes,
  onChange,
  onRemove,
}: {
  row: CompatRow;
  makes: string[];
  onChange: (field: keyof CompatRow, value: string) => void;
  onRemove: () => void;
}) {
  const { data: models } = useVehicleModels(row.make || undefined);
  const yearInvalid =
    row.yearFrom !== '' && row.yearTo !== '' && Number(row.yearFrom) > Number(row.yearTo);
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-500">Make *</label>
          <SearchableSelect
            value={row.make}
            options={makes}
            placeholder="Search make…"
            onChange={(v) => onChange('make', v)}
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500">Model</label>
          <SearchableSelect
            value={row.model}
            options={models ?? []}
            placeholder={row.make ? 'Search model… (leave empty = all)' : 'Pick a make first'}
            disabled={!row.make}
            onChange={(v) => onChange('model', v)}
          />
        </div>
        <div className="w-24">
          <label className="block text-xs text-gray-500">Year from *</label>
          <input
            type="number"
            min="1900"
            max="2100"
            required
            value={row.yearFrom}
            onChange={(e) => onChange('yearFrom', e.target.value)}
            className={`mt-0.5 block w-full rounded-md border px-2 py-1.5 text-sm ${
              row.yearFrom === '' || yearInvalid ? 'border-red-300' : 'border-gray-300'
            }`}
          />
        </div>
        <div className="w-24">
          <label className="block text-xs text-gray-500">Year to *</label>
          <input
            type="number"
            min="1900"
            max="2100"
            required
            value={row.yearTo}
            onChange={(e) => onChange('yearTo', e.target.value)}
            className={`mt-0.5 block w-full rounded-md border px-2 py-1.5 text-sm ${
              row.yearTo === '' || yearInvalid ? 'border-red-300' : 'border-gray-300'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="mb-0.5 text-red-500 hover:text-red-700"
          aria-label="Remove row"
        >
          &#x2715;
        </button>
      </div>
      {yearInvalid && (
        <p className="mt-1 text-xs text-red-600">Year from must be ≤ year to</p>
      )}
    </div>
  );
}

interface CompatLike {
  make?: string;
  model?: string | null;
  year_from?: number | null;
  year_to?: number | null;
}

/**
 * Summarise a part's compatibility rows into Make / Model / Year cells.
 * Universal parts return "ALL" in every cell.
 */
function summariseCompatibility(
  isUniversal: boolean,
  rows: CompatLike[] | undefined,
): { make: string; model: string; year: string } {
  if (isUniversal) return { make: 'ALL', model: 'ALL', year: 'ALL' };
  if (!rows || rows.length === 0) return { make: '—', model: '—', year: '—' };
  const makes = Array.from(new Set(rows.map((r) => r.make).filter(Boolean) as string[])).sort();
  const models = Array.from(
    new Set(
      rows.map((r) => (r.model && r.model.trim()) || null).filter(Boolean) as string[],
    ),
  ).sort();
  const allYearsFrom = rows.map((r) => r.year_from).filter((y): y is number => y != null);
  const allYearsTo = rows.map((r) => r.year_to).filter((y): y is number => y != null);
  const yearStr =
    allYearsFrom.length === 0 && allYearsTo.length === 0
      ? '—'
      : `${allYearsFrom.length ? Math.min(...allYearsFrom) : '…'}/${allYearsTo.length ? Math.max(...allYearsTo) : '…'}`;
  return {
    make: makes.length === 0 ? '—' : makes.length === 1 ? (makes[0] ?? '—') : makes.join(', '),
    model: models.length === 0 ? '— (all)' : models.length === 1 ? (models[0] ?? '—') : models.join(', '),
    year: yearStr,
  };
}

function buildCatalogueRows(parts: CataloguePart[]): unknown[][] {
  const rows: unknown[][] = [[
    'Part number', 'Description', 'Category', 'Make', 'Model', 'Year from', 'Year to',
    'Stock', 'Reorder point', 'Unit cost', 'Sell price', 'IVA', 'Vendor', 'Location',
  ]];
  for (const p of parts) {
    const summary = summariseCompatibility(p.is_universal, p.compatibility);
    let yearFrom: string | number = '';
    let yearTo: string | number = '';
    if (p.is_universal) {
      yearFrom = 'ALL';
      yearTo = 'ALL';
    } else if (p.compatibility && p.compatibility.length > 0) {
      const fs = p.compatibility.map((c) => c.year_from).filter((y): y is number => y != null);
      const ts = p.compatibility.map((c) => c.year_to).filter((y): y is number => y != null);
      yearFrom = fs.length ? Math.min(...fs) : '';
      yearTo = ts.length ? Math.max(...ts) : '';
    }
    rows.push([
      p.part_number ?? '',
      p.description,
      p.category ?? '',
      summary.make,
      summary.model,
      yearFrom,
      yearTo,
      p.stock_qty,
      p.reorder_point,
      p.unit_cost,
      p.sell_price,
      p.tax_code ? `${p.tax_code.code} (${p.tax_code.rate}%)` : '',
      p.vendor?.name ?? '',
      p.location ?? '',
    ]);
  }
  return rows;
}

function compatRowsToPayload(rows: CompatRow[]): Array<{ make: string; model?: string | null; yearFrom: number; yearTo: number }> {
  return rows
    .filter((r) => r.make.trim().length > 0)
    .map((r) => ({
      make: r.make.trim(),
      model: r.model.trim() === '' ? null : r.model.trim(),
      yearFrom: Number(r.yearFrom),
      yearTo: Number(r.yearTo),
    }));
}

function validateCompatRows(rows: CompatRow[]): string | null {
  for (const r of rows) {
    if (!r.make.trim()) return 'Every compatibility row must have a make.';
    if (r.yearFrom.trim() === '' || r.yearTo.trim() === '') {
      return 'Year from and Year to are required on every compatibility row.';
    }
    const yf = Number(r.yearFrom);
    const yt = Number(r.yearTo);
    if (!Number.isFinite(yf) || !Number.isFinite(yt)) return 'Year values must be numbers.';
    if (yf > yt) return 'Year from must be ≤ year to.';
    if (yf < 1900 || yt > 2100) return 'Years must be between 1900 and 2100.';
  }
  return null;
}

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

  const sp = useSearchParams();
  const [consumableFilter, setConsumableFilter] = useState(false);
  useEffect(() => {
    setConsumableFilter(sp.get('consumable') === 'true');
  }, [sp]);

  const { data, isLoading, isError, error } = useParts(
    page,
    debouncedSearch,
    category || undefined,
    undefined,
    consumableFilter,
  );
  const { data: lowStockData } = useLowStock();
  const createMutation = useCreatePart();
  const updateMutation = useUpdatePart();
  const exportMutation = useExportParts();
  const [editPart, setEditPart] = useState<Record<string, unknown> | null>(null);
  const [editForm, setEditForm] = useState({
    description: '',
    category: 'Other',
    reorderPoint: 0,
    unitCost: 0,
    sellPrice: 0,
    location: '',
    taxCodeId: '',
  });
  const [editIsUniversal, setEditIsUniversal] = useState(false);
  const [editIsConsumable, setEditIsConsumable] = useState(false);
  const [editUom, setEditUom] = useState('each');
  const [editPackSize, setEditPackSize] = useState('1');
  const [editCompat, setEditCompat] = useState<CompatRow[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

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
  const [isUniversal, setIsUniversal] = useState(false);
  const [isConsumable, setIsConsumable] = useState(false);
  const [uom, setUom] = useState('each');
  const [packSize, setPackSize] = useState('1');
  const [compat, setCompat] = useState<CompatRow[]>([]);

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
      if (!isUniversal) {
        if (compat.length === 0) {
          setFormError('Mark the part as "Fits all vehicles" or add at least one make/model row.');
          return;
        }
        const compatError = validateCompatRows(compat);
        if (compatError) {
          setFormError(compatError);
          return;
        }
      }
      const compatibility = compatRowsToPayload(compat);
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
        isUniversal,
        isConsumable,
        uom: uom || 'each',
        packSize: Number(packSize) || 1,
        compatibility,
      });
      setShowModal(false);
      setForm({ partNumber: '', description: '', category: 'Other', stockQty: 0, reorderPoint: 5, unitCost: 0, sellPrice: 0, location: '', taxCodeId: '' });
      setIsUniversal(false);
      setIsConsumable(false);
      setUom('each');
      setPackSize('1');
      setCompat([]);
      toast.success('Saved successfully!');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create part');
    }
  };

  const handleAddFromTecDoc = async (part: Record<string, unknown>) => {
    try {
      setAddingPart(part.partNumber as string);
      const avgPrice = (part.avgPrice as number) ?? 0;
      const defaultTax = taxCodes.find((t) => t.is_default) ?? taxCodes[0];
      // TecDoc returns make/model but no year range, and year is now
      // required on every compat row. Save the part as universal so it
      // creates cleanly, then prompt the user to edit it with the right
      // year range.
      await createMutation.mutateAsync({
        partNumber: part.partNumber as string,
        description: part.description as string,
        category: part.category as string,
        stockQty: 0,
        reorderPoint: 5,
        unitCost: avgPrice / 100,
        sellPrice: (avgPrice * 1.3) / 100,
        taxCodeId: defaultTax?.id,
        isUniversal: true,
        compatibility: [],
      });
      toast.success(
        tdMake.trim()
          ? `${tt('addedToCatalogue')} — edit it to scope to ${tdMake}${tdModel ? ' ' + tdModel : ''} with a year range.`
          : tt('addedToCatalogue'),
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to add part');
    } finally {
      setAddingPart(null);
    }
  };

  const openEdit = async (part: Record<string, unknown>) => {
    setEditError(null);
    setEditPart(part);
    setEditForm({
      description: (part.description as string) ?? '',
      category: (part.category as string) ?? 'Other',
      reorderPoint: Number(part.reorder_point ?? 0),
      unitCost: Number(part.unit_cost ?? 0),
      sellPrice: Number(part.sell_price ?? 0),
      location: (part.location as string) ?? '',
      taxCodeId: (part.tax_code_id as string) ?? '',
    });
    setEditIsUniversal(Boolean(part.is_universal));
    setEditIsConsumable(Boolean(part.is_consumable));
    setEditUom((part.uom as string) || 'each');
    setEditPackSize(part.pack_size != null ? String(part.pack_size) : '1');
    setEditCompat([]);
    // Fetch full part (list payload doesn't include compatibility[])
    try {
      const full = await api.get<Record<string, unknown>>(`/parts/${part.id as string}`);
      setEditIsUniversal(Boolean(full.is_universal));
      setEditIsConsumable(Boolean(full.is_consumable));
      setEditUom((full.uom as string) || 'each');
      setEditPackSize(full.pack_size != null ? String(full.pack_size) : '1');
      const compatRows = (full.compatibility as Array<Record<string, unknown>> | undefined) ?? [];
      setEditCompat(
        compatRows.map((r) => ({
          make: (r.make as string) ?? '',
          model: ((r.model as string | null) ?? '') || '',
          yearFrom: r.year_from == null ? '' : String(r.year_from),
          yearTo: r.year_to == null ? '' : String(r.year_to),
        })),
      );
    } catch {
      // non-fatal — user can still edit core fields
    }
  };

  const handleUpdate = async () => {
    if (!editPart) return;
    try {
      setEditError(null);
      if (!editIsUniversal) {
        if (editCompat.length === 0) {
          setEditError('Mark the part as "Fits all vehicles" or add at least one make/model row.');
          return;
        }
        const compatError = validateCompatRows(editCompat);
        if (compatError) {
          setEditError(compatError);
          return;
        }
      }
      const compatibility = compatRowsToPayload(editCompat);
      await updateMutation.mutateAsync({
        id: editPart.id as string,
        description: editForm.description,
        category: editForm.category || undefined,
        reorderPoint: Number(editForm.reorderPoint),
        unitCost: Number(editForm.unitCost),
        sellPrice: Number(editForm.sellPrice),
        location: editForm.location || undefined,
        taxCodeId: editForm.taxCodeId || undefined,
        isUniversal: editIsUniversal,
        isConsumable: editIsConsumable,
        uom: editUom || 'each',
        packSize: Number(editPackSize) || 1,
        compatibility,
      });
      setEditPart(null);
      toast.success('Saved successfully!');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update part');
    }
  };

  const handleTdSearch = () => {
    if (tdMake && tdModel) {
      setTdSearchTriggered(true);
    }
  };

  const handleExport = async () => {
    try {
      const parts = await exportMutation.mutateAsync();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadXlsx(`parts-catalogue-${stamp}`, buildCatalogueRows(parts), 'Parts');
      toast.success(`Exported ${parts.length} parts`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
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
            onClick={handleExport}
            disabled={exportMutation.isPending}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {exportMutation.isPending ? 'Exporting…' : 'Export to Excel'}
          </button>
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
        {consumableFilter && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800 ring-1 ring-inset ring-blue-200">
            Showing consumables only
            <Link
              href="/parts"
              className="ml-1 text-blue-600 hover:underline"
              onClick={() => setConsumableFilter(false)}
            >
              clear
            </Link>
          </span>
        )}
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={8} />
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
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Make</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Model</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Year</th>
                  <SortableHeader label={t('stock')} field="stock_qty" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <SortableHeader label={t('costPrice')} field="unit_cost" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('sellPrice')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">IVA</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('category')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(() => {
                  const parts = data?.data ?? [];
                  const sorted = sortData(parts, sortField, sortDir);
                  return sorted.length > 0 ? (
                  sorted.map((part) => {
                    const compatRows = part.compatibility as CompatLike[] | undefined;
                    const summary = summariseCompatibility(Boolean(part.is_universal), compatRows);
                    const isAll = Boolean(part.is_universal);
                    return (
                    <tr key={part.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium">
                        <Link href={`/parts/${part.id as string}`} className="text-primary-600 hover:underline">
                          {part.part_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{part.description}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {isAll ? (
                          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">ALL</span>
                        ) : (
                          <span className="text-xs">{summary.make}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {isAll ? (
                          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">ALL</span>
                        ) : (
                          <span className="text-xs">{summary.model}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {isAll ? (
                          <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">ALL</span>
                        ) : (
                          <span className="text-xs font-mono">{summary.year}</span>
                        )}
                      </td>
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
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {part.tax_code ? (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            {(part.tax_code as { code: string }).code} ({Number((part.tax_code as { rate: number }).rate).toFixed(0)}%)
                          </span>
                        ) : (
                          <span className="text-xs text-red-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{part.category as string}</td>
                      <td className="px-4 py-3 text-end text-sm">
                        <button
                          onClick={() => openEdit(part as unknown as Record<string, unknown>)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          {tc('edit')}
                        </button>
                      </td>
                    </tr>
                  );})
                ) : (
                  <tr>
                    <td colSpan={11}>
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
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
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

              <div className="rounded-md border border-gray-200 bg-white p-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isConsumable}
                    onChange={(e) => setIsConsumable(e.target.checked)}
                  />
                  <span className="font-medium text-gray-700">Consumable</span>
                  <span className="text-xs text-gray-500">
                    (oil, coolant, brake fluid, paint, cleaning products…)
                  </span>
                </label>
              </div>

              <UomFields uom={uom} packSize={packSize} onUomChange={setUom} onPackSizeChange={setPackSize} />

              <CompatibilityEditor
                isUniversal={isUniversal}
                rows={compat}
                onToggleUniversal={setIsUniversal}
                onChange={setCompat}
                makesFallback={MAKES}
              />

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

      {/* Edit Part Modal */}
      {editPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {tc('edit')} — {editPart.part_number as string}
              </h2>
              <button onClick={() => setEditPart(null)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              {editError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{editError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('description')}</label>
                <input
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('category')}</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('reorderPoint')}</label>
                  <input
                    type="number"
                    value={editForm.reorderPoint}
                    onChange={(e) => setEditForm({ ...editForm, reorderPoint: Number(e.target.value) })}
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
                    value={editForm.unitCost}
                    onChange={(e) => setEditForm({ ...editForm, unitCost: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('sellPrice')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.sellPrice}
                    onChange={(e) => setEditForm({ ...editForm, sellPrice: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('location')}</label>
                <input
                  value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">IVA *</label>
                <select
                  value={editForm.taxCodeId}
                  onChange={(e) => setEditForm({ ...editForm, taxCodeId: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white"
                  required
                >
                  <option value="">—</option>
                  {taxCodes.map((tx) => (
                    <option key={tx.id} value={tx.id}>
                      {tx.code} — {tx.name} ({Number(tx.rate).toFixed(0)}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editIsConsumable}
                    onChange={(e) => setEditIsConsumable(e.target.checked)}
                  />
                  <span className="font-medium text-gray-700">Consumable</span>
                  <span className="text-xs text-gray-500">
                    (oil, coolant, brake fluid, paint, cleaning products…)
                  </span>
                </label>
              </div>

              <UomFields uom={editUom} packSize={editPackSize} onUomChange={setEditUom} onPackSizeChange={setEditPackSize} />

              <CompatibilityEditor
                isUniversal={editIsUniversal}
                rows={editCompat}
                onToggleUniversal={setEditIsUniversal}
                onChange={setEditCompat}
                makesFallback={MAKES}
              />

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditPart(null)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? tc('loading') : tc('save')}
                </button>
              </div>
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
                        credentials: 'include',
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
                      credentials: 'include',
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
