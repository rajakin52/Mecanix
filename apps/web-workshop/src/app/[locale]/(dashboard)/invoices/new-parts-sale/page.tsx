'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, Link } from '@/i18n/navigation';
import { useToast } from '@mecanix/ui-web';
import { useCustomers } from '@/hooks/use-customers';
import { useParts, useVehicleMakes, useVehicleModels } from '@/hooks/use-parts';
import { useWarehouses } from '@/hooks/use-warehouse';
import { useCreateStandaloneInvoice, type StandaloneLine } from '@/hooks/use-invoices';
import { useCreateProforma } from '@/hooks/use-proformas';
import { SearchableSelect } from '@/components/SearchableSelect';
import { formatCurrency } from '@/lib/format';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';

interface LineRow {
  partId: string;
  description: string;
  quantity: string;
  unitCost: string;
  sellPrice: string;
  discountPct: string;
  discountAmount: string;
}

const EMPTY_LINE: LineRow = {
  partId: '',
  description: '',
  quantity: '1',
  unitCost: '0',
  sellPrice: '0',
  discountPct: '0',
  discountAmount: '0',
};

export default function NewPartsSalePage() {
  const router = useRouter();
  const toast = useToast();
  const [output, setOutput] = useState<'invoice' | 'proforma'>('invoice');
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>([{ ...EMPTY_LINE }]);
  const [invoiceDiscountPct, setInvoiceDiscountPct] = useState('0');
  const [invoiceDiscountAmount, setInvoiceDiscountAmount] = useState('0');
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Warehouses for the stock-source picker. Multi-warehouse tenants must
  // disambiguate; single-warehouse tenants can ignore it (default warehouse
  // is auto-picked server-side).
  const { data: warehousesData } = useWarehouses(1);
  const warehouses = useMemo(() => warehousesData?.data ?? [], [warehousesData]);
  // Auto-pick the default warehouse on first load so the dropdown doesn't
  // start empty when the user hasn't chosen yet.
  useEffect(() => {
    if (warehouseId || warehouses.length === 0) return;
    const defaultWh = warehouses.find((w) => w.is_default) ?? warehouses[0];
    if (defaultWh?.id) setWarehouseId(defaultWh.id);
  }, [warehouses, warehouseId]);

  const { data: customersData } = useCustomers(1, '');
  const customers = useMemo(() => {
    const list = customersData?.data ?? [];
    return list.map((c) => ({
      value: c.id as string,
      label: `${c.full_name as string}${c.phone ? ' · ' + c.phone : ''}`,
    }));
  }, [customersData]);

  // Server-side parts search — useParts pages 20 at a time, so a static
  // load only ever surfaces the first 20 of the catalogue. Track the
  // user's typed query, debounce, and refetch.
  const [partSearchInput, setPartSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(partSearchInput), 250);
    return () => clearTimeout(t);
  }, [partSearchInput]);

  // Vehicle scope: narrows the catalogue to parts that fit the chosen
  // make/model/year. Parts marked "Fits all vehicles" still appear.
  // Leave empty to see everything.
  const [filterMake, setFilterMake] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const vehicleScope = filterMake
    ? {
        make: filterMake,
        model: filterModel || undefined,
        year: filterYear ? Number(filterYear) : undefined,
      }
    : undefined;
  const { data: vehicleMakes } = useVehicleMakes();
  const { data: vehicleModels } = useVehicleModels(filterMake || undefined);
  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const out: string[] = [];
    for (let y = current + 1; y >= 1990; y--) out.push(String(y));
    return out;
  }, []);
  const resetVehicleFilter = () => {
    setFilterMake('');
    setFilterModel('');
    setFilterYear('');
  };

  // pageSize=1000 so the picker shows the whole catalogue at once instead
  // of the first 20. Server-side search still narrows on type for very
  // large catalogues.
  const { data: partsData } = useParts(1, debouncedSearch, undefined, vehicleScope, undefined, 1000);
  const parts = partsData?.data ?? [];
  const partOptions = useMemo(
    () => parts.map((p) => ({ value: p.id, label: `${p.part_number ?? '—'} · ${p.description}` })),
    [parts],
  );

  const createInvoice = useCreateStandaloneInvoice();
  const createProforma = useCreateProforma();
  const saving = createInvoice.isPending || createProforma.isPending;

  const updateLine = (idx: number, patch: Partial<LineRow>) => {
    setLines((rows) => {
      const next = [...rows];
      const cur = next[idx];
      if (!cur) return rows;
      next[idx] = { ...cur, ...patch };
      return next;
    });
  };

  const onPickPart = (idx: number, partId: string) => {
    const p = parts.find((x) => x.id === partId);
    if (!p) {
      updateLine(idx, { partId });
      return;
    }
    updateLine(idx, {
      partId,
      description: p.description,
      unitCost: String(p.unit_cost ?? 0),
      sellPrice: String(p.sell_price ?? 0),
    });
  };

  const addLine = () => setLines((rows) => [...rows, { ...EMPTY_LINE }]);
  const removeLine = (idx: number) => setLines((rows) => rows.filter((_, i) => i !== idx));

  // Live preview — mirrors the backend math so the user can sanity-check
  // discounts before submitting. VAT not included here; that's resolved
  // server-side from the line tax codes.
  const linesGross = lines.reduce((sum, l) => {
    const q = Number(l.quantity) || 0;
    const p = Number(l.sellPrice) || 0;
    return sum + q * p;
  }, 0);
  const lineDiscounts = lines.reduce((sum, l) => {
    const q = Number(l.quantity) || 0;
    const p = Number(l.sellPrice) || 0;
    const gross = q * p;
    const dPct = Number(l.discountPct) || 0;
    const dAmt = Number(l.discountAmount) || 0;
    return sum + Math.min(gross, (gross * dPct) / 100 + dAmt);
  }, 0);
  const linesNet = linesGross - lineDiscounts;
  const invoiceDiscount = Math.min(
    linesNet,
    (linesNet * (Number(invoiceDiscountPct) || 0)) / 100 + (Number(invoiceDiscountAmount) || 0),
  );
  const total = linesNet - invoiceDiscount;

  const handleSubmit = async () => {
    setError(null);
    if (!customerId) {
      setError('Pick a customer first.');
      return;
    }
    const cleanLines: StandaloneLine[] = [];
    for (const [i, l] of lines.entries()) {
      if (!l.description.trim()) {
        setError(`Line ${i + 1}: description is required.`);
        return;
      }
      const qty = Number(l.quantity);
      const sell = Number(l.sellPrice);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Line ${i + 1}: quantity must be > 0.`);
        return;
      }
      if (!Number.isFinite(sell) || sell < 0) {
        setError(`Line ${i + 1}: sell price must be ≥ 0.`);
        return;
      }
      cleanLines.push({
        partId: l.partId || undefined,
        description: l.description.trim(),
        quantity: qty,
        unitCost: l.unitCost === '' ? undefined : Number(l.unitCost),
        sellPrice: sell,
        discountPct: Number(l.discountPct) || 0,
        discountAmount: Number(l.discountAmount) || 0,
      });
    }

    const invDiscPct = Number(invoiceDiscountPct) || 0;
    const invDiscAmt = Number(invoiceDiscountAmount) || 0;

    try {
      if (output === 'invoice') {
        const inv = await createInvoice.mutateAsync({
          customerId,
          lines: cleanLines,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
          discountPct: invDiscPct,
          discountAmount: invDiscAmt,
          warehouseId: warehouseId || undefined,
        });
        toast.success(`Invoice ${inv.invoice_number} created`);
        router.push(`/invoices/${inv.id}`);
      } else {
        const pro = await createProforma.mutateAsync({
          customerId,
          lines: cleanLines,
          validUntil: validUntil || undefined,
          notes: notes || undefined,
          discountPct: invDiscPct,
          discountAmount: invDiscAmt,
        });
        toast.success(`Proforma ${pro.proforma_number} created`);
        router.push(`/proformas/${pro.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Link href="/invoices" className="inline-flex items-center text-sm text-primary-600 hover:underline">
          <ChevronLeft className="h-4 w-4" /> Invoices
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New parts sale</h1>
          <p className="text-sm text-gray-500">
            Over-the-counter parts sale — no job card, no vehicle. Choose to issue an invoice (FT) or a quote (proforma).
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setOutput('invoice')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${output === 'invoice' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Invoice (FT)
          </button>
          <button
            onClick={() => setOutput('proforma')}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${output === 'proforma' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Proforma
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="space-y-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer *</label>
              <div className="mt-1">
                <SearchableSelect
                  value={customerId}
                  options={customers}
                  placeholder="Search customer…"
                  allowFreeText={false}
                  onChange={(id) => {
                    setCustomerId(id);
                    // Pre-fill due date from the customer's credit terms
                    // (0 = due on receipt). User can still override.
                    if (!id) return;
                    const list = customersData?.data ?? [];
                    const c = list.find((x) => x.id === id) as unknown as
                      Record<string, unknown> | undefined;
                    const days = Number(c?.['credit_terms_days'] ?? 0);
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    setDueDate(d.toISOString().slice(0, 10));
                  }}
                />
              </div>
            </div>
            {output === 'invoice' && warehouses.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Stock leaves from *</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                      {w.is_default ? ' (default)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Stock is deducted from this warehouse. Proformas don&apos;t touch stock,
                  so this picker is hidden when issuing a proforma.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
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
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-500">Make</label>
              <SearchableSelect
                value={filterMake}
                options={vehicleMakes ?? []}
                placeholder="Search make…"
                onChange={(v) => {
                  setFilterMake(v);
                  setFilterModel('');
                }}
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
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Line items</h2>
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <Plus className="h-4 w-4" /> Add line
            </button>
          </div>

          <div className="space-y-2">
            {lines.map((line, idx) => {
              const qty = Number(line.quantity) || 0;
              const sell = Number(line.sellPrice) || 0;
              const gross = qty * sell;
              const dPct = Number(line.discountPct) || 0;
              const dAmt = Number(line.discountAmount) || 0;
              const lineDisc = Math.min(gross, (gross * dPct) / 100 + dAmt);
              const sub = gross - lineDisc;
              return (
                <div key={idx} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-xs text-gray-500">Part (optional)</label>
                      <SearchableSelect
                        value={line.partId}
                        options={partOptions}
                        placeholder="Search part…"
                        allowFreeText={false}
                        onChange={(v) => onPickPart(idx, v)}
                        onInputChange={setPartSearchInput}
                      />
                    </div>
                    <div className="col-span-12 sm:col-span-4">
                      <label className="block text-xs text-gray-500">Description *</label>
                      <input
                        value={line.description}
                        onChange={(e) => updateLine(idx, { description: e.target.value })}
                        className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <label className="block text-xs text-gray-500">Qty *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={line.quantity}
                        onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                        className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-1">
                      <label className="block text-xs text-gray-500">Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        value={line.unitCost}
                        onChange={(e) => updateLine(idx, { unitCost: e.target.value })}
                        className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="col-span-5 sm:col-span-2">
                      <label className="block text-xs text-gray-500">Sell *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.sellPrice}
                        onChange={(e) => updateLine(idx, { sellPrice: e.target.value })}
                        className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-1">
                      <label className="block text-xs text-gray-500">Disc %</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={line.discountPct}
                        onChange={(e) => updateLine(idx, { discountPct: e.target.value })}
                        className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div className="col-span-6 sm:col-span-1">
                      <label className="block text-xs text-gray-500">Disc amt</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={line.discountAmount}
                        onChange={(e) => updateLine(idx, { discountAmount: e.target.value })}
                        className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {lineDisc > 0 ? (
                        <>
                          Gross <span className="text-gray-700">{formatCurrency(gross)}</span>
                          {' · '}Disc <span className="text-red-600">−{formatCurrency(lineDisc)}</span>
                          {' · '}Subtotal <span className="font-medium text-gray-900">{formatCurrency(sub)}</span>
                        </>
                      ) : (
                        <>Subtotal <span className="font-medium text-gray-900">{formatCurrency(sub)}</span></>
                      )}
                    </div>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLine(idx)}
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Invoice-global discount + totals preview */}
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div>
                <label className="block text-xs text-gray-500">Invoice discount %</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={invoiceDiscountPct}
                  onChange={(e) => setInvoiceDiscountPct(e.target.value)}
                  className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500">Invoice discount amt</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={invoiceDiscountAmount}
                  onChange={(e) => setInvoiceDiscountAmount(e.target.value)}
                  className="mt-0.5 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Lines gross</span>
                <span>{formatCurrency(linesGross)}</span>
              </div>
              {lineDiscounts > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Line discounts</span>
                  <span>−{formatCurrency(lineDiscounts)}</span>
                </div>
              )}
              {invoiceDiscount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Invoice discount</span>
                  <span>−{formatCurrency(invoiceDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-semibold text-gray-900">
                <span>Lines total (pre-tax)</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2">
          {output === 'invoice' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700">Valid until</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Link
            href="/invoices"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !customerId}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : output === 'invoice' ? 'Create Invoice' : 'Create Proforma'}
          </button>
        </div>
      </div>
    </div>
  );
}
