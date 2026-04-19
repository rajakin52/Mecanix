'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useCreateStandaloneEstimate } from '@/hooks/use-estimates';

interface Customer { id: string; full_name: string; phone: string; email: string | null }
interface Vehicle { id: string; plate: string; make: string; model: string; year: number | null; customer_id: string }
interface CatalogItem { id: string; name: string; code: string | null; category: string | null; type: string; estimated_hours: number | null; quick_access?: boolean }

type RepairFilter = 'quick' | 'mechanic' | 'body';
const BODY_CATEGORIES = ['Body Repair'];

interface LabourLine { description: string; hours: number; rate: number }
interface PartsLine { partName: string; partNumber: string; quantity: number; unitCost: number; markupPct: number }

type Step = 'customer' | 'lines' | 'review';
const STEPS: { key: Step; label: string }[] = [
  { key: 'customer', label: '1. Customer & Vehicle' },
  { key: 'lines', label: '2. Line Items' },
  { key: 'review', label: '3. Review & Create' },
];

export default function NewEstimateWizard() {
  const tc = useTranslations('common');
  const router = useRouter();
  const createMutation = useCreateStandaloneEstimate();

  const [step, setStep] = useState<Step>('customer');
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // Customer & Vehicle
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [reportedProblem, setReportedProblem] = useState('');

  // Lines
  const [labourLines, setLabourLines] = useState<LabourLine[]>([]);
  const [partsLines, setPartsLines] = useState<PartsLine[]>([]);
  const [repairFilter, setRepairFilter] = useState<RepairFilter>('mechanic');
  const [catalogSearch, setCatalogSearch] = useState('');

  // New line forms
  const [newLabour, setNewLabour] = useState<LabourLine>({ description: '', hours: 1, rate: 0 });
  const [newPart, setNewPart] = useState<PartsLine>({ partName: '', partNumber: '', quantity: 1, unitCost: 0, markupPct: 0 });

  // Terms
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');

  // Error
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Queries
  const { data: customers } = useQuery({
    queryKey: ['customers-search', customerSearch],
    queryFn: () => api.get<{ data: Customer[] } | Customer[]>(`/customers?search=${encodeURIComponent(customerSearch)}&pageSize=20`),
    enabled: customerSearch.length > 0,
  });

  const { data: customerVehicles } = useQuery({
    queryKey: ['customer-vehicles', selectedCustomer?.id],
    queryFn: () => api.get<{ data: Vehicle[] } | Vehicle[]>(`/vehicles?customerId=${selectedCustomer!.id}&pageSize=50`),
    enabled: !!selectedCustomer,
  });

  const { data: catalogData } = useQuery({
    queryKey: ['catalog-all'],
    queryFn: () => api.get<CatalogItem[]>('/catalog'),
  });

  const customerList = Array.isArray(customers) ? customers : (customers as { data: Customer[] } | undefined)?.data ?? [];
  const vehicleList = Array.isArray(customerVehicles) ? customerVehicles : (customerVehicles as { data: Vehicle[] } | undefined)?.data ?? [];
  const allCatalog = Array.isArray(catalogData) ? catalogData : [];

  // Calculations
  const labourTotal = labourLines.reduce((s, l) => s + l.hours * l.rate, 0);
  const partsTotal = partsLines.reduce((s, p) => s + p.quantity * p.unitCost * (1 + p.markupPct / 100), 0);
  const subtotal = labourTotal + partsTotal;
  const taxRate = 14; // Will be resolved server-side
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount;

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const canNext = (): boolean => {
    switch (step) {
      case 'customer': return !!selectedCustomer && !!selectedVehicle;
      case 'lines': return labourLines.length > 0 || partsLines.length > 0;
      case 'review': return true;
      default: return false;
    }
  };

  const goNext = () => { if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]!.key); };
  const goBack = () => { if (stepIndex > 0) setStep(STEPS[stepIndex - 1]!.key); };

  const addLabourLine = () => {
    if (!newLabour.description.trim()) return;
    setLabourLines([...labourLines, { ...newLabour }]);
    setNewLabour({ description: '', hours: 1, rate: 0 });
  };

  const addPartsLine = () => {
    if (!newPart.partName.trim()) return;
    setPartsLines([...partsLines, { ...newPart }]);
    setNewPart({ partName: '', partNumber: '', quantity: 1, unitCost: 0, markupPct: 0 });
  };

  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedVehicle) return;
    if (labourLines.length === 0 && partsLines.length === 0) return;
    setSubmitting(true);
    setError('');

    try {
      const estimate = await createMutation.mutateAsync({
        customerId: selectedCustomer.id,
        vehicleId: selectedVehicle.id,
        reportedProblem: reportedProblem.trim() || undefined,
        labourLines,
        partsLines,
        terms: terms.trim() || undefined,
        validUntil: validUntil || undefined,
      });

      router.push(`/estimates/${estimate.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create estimate');
      setSubmitting(false);
    }
  };

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link href="/estimates" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Estimates</Link>
          <h1 className="text-xl font-bold text-gray-900">New Estimate</h1>
          <div className="w-20" />
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <button key={s.key} onClick={() => i <= stepIndex && setStep(s.key)}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  i < stepIndex ? 'text-green-600 cursor-pointer' :
                  i === stepIndex ? 'text-primary-600' : 'text-gray-400'
                }`}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                  i < stepIndex ? 'bg-green-100 text-green-700' :
                  i === stepIndex ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {i < stepIndex ? '\u2713' : i + 1}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            ))}
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {/* ── STEP 1: Customer & Vehicle ── */}
        {step === 'customer' && (
          <div className="space-y-6">
            {/* Customer search */}
            {!selectedCustomer && (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Find Customer</h3>
                <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by name or phone..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                <div className="mt-3 max-h-60 overflow-y-auto space-y-1">
                  {customerList.map((c) => (
                    <button key={c.id} onClick={() => setSelectedCustomer(c)}
                      className="w-full text-start rounded-lg border border-gray-100 px-4 py-3 hover:border-primary-300 hover:bg-primary-50 transition-colors">
                      <span className="font-semibold text-gray-900">{c.full_name}</span>
                      <span className="ms-3 text-sm text-gray-500">{c.phone}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Selected customer */}
            {selectedCustomer && !selectedVehicle && (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-green-600 font-semibold uppercase">Customer</span>
                    <p className="font-bold text-green-900">{selectedCustomer.full_name}</p>
                    <p className="text-sm text-green-700">{selectedCustomer.phone}</p>
                  </div>
                  <button onClick={() => { setSelectedCustomer(null); setSelectedVehicle(null); }} className="text-xs text-green-600 hover:text-green-800">Change</button>
                </div>

                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Select Vehicle</h3>
                  {vehicleList.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {vehicleList.map((v) => (
                        <button key={v.id} onClick={() => setSelectedVehicle(v)}
                          className="w-full text-start rounded-lg border-2 border-gray-200 px-4 py-3 hover:border-primary-500 hover:bg-primary-50 transition-all">
                          <span className="text-lg font-mono font-bold text-gray-900">{v.plate}</span>
                          <span className="ms-3 text-sm text-gray-600">{v.make} {v.model} {v.year ? `(${v.year})` : ''}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No vehicles found for this customer.</p>
                  )}
                </div>
              </div>
            )}

            {/* Both selected */}
            {selectedCustomer && selectedVehicle && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                    <span className="text-xs text-green-600 font-semibold uppercase">Customer</span>
                    <p className="font-bold text-green-900">{selectedCustomer.full_name}</p>
                    <p className="text-sm text-green-700">{selectedCustomer.phone}</p>
                    <button onClick={() => { setSelectedCustomer(null); setSelectedVehicle(null); }} className="mt-2 text-xs text-green-600 hover:text-green-800">Change</button>
                  </div>
                  <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                    <span className="text-xs text-blue-600 font-semibold uppercase">Vehicle</span>
                    <p className="font-bold font-mono text-blue-900">{selectedVehicle.plate}</p>
                    <p className="text-sm text-blue-700">{selectedVehicle.make} {selectedVehicle.model}</p>
                    <button onClick={() => setSelectedVehicle(null)} className="mt-2 text-xs text-blue-600 hover:text-blue-800">Change</button>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700">Reported Problem / Reason</label>
                  <textarea value={reportedProblem} onChange={(e) => setReportedProblem(e.target.value)}
                    rows={3} placeholder="Describe what the customer wants..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Line Items ── */}
        {step === 'lines' && (
          <div className="space-y-6">
            {/* Labour Lines */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Labour</h3>
              {labourLines.length > 0 && (
                <div className="mb-4 space-y-2">
                  {labourLines.map((l, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                      <span className="text-sm text-gray-900 flex-1">{l.description}</span>
                      <span className="text-xs text-gray-500">{l.hours}h</span>
                      <span className="text-xs text-gray-500">@ {l.rate}</span>
                      <span className="text-sm font-semibold text-gray-900">{round2(l.hours * l.rate).toFixed(2)}</span>
                      <button onClick={() => setLabourLines(labourLines.filter((_, j) => j !== i))} className="text-red-500 text-xs font-semibold">Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-12 gap-2">
                <input value={newLabour.description} onChange={(e) => setNewLabour({ ...newLabour, description: e.target.value })}
                  placeholder="Description" className="col-span-6 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input type="number" value={newLabour.hours} onChange={(e) => setNewLabour({ ...newLabour, hours: Number(e.target.value) })}
                  placeholder="Hours" min="0.1" step="0.5" className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input type="number" value={newLabour.rate} onChange={(e) => setNewLabour({ ...newLabour, rate: Number(e.target.value) })}
                  placeholder="Rate" min="0" className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <button onClick={addLabourLine} disabled={!newLabour.description.trim()}
                  className="col-span-2 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
                  Add
                </button>
              </div>
            </div>

            {/* Parts Lines */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Parts</h3>
              {partsLines.length > 0 && (
                <div className="mb-4 space-y-2">
                  {partsLines.map((p, i) => {
                    const sellPrice = p.unitCost * (1 + p.markupPct / 100);
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                        <span className="text-sm text-gray-900 flex-1">{p.partName}</span>
                        <span className="text-xs text-gray-500">x{p.quantity}</span>
                        <span className="text-xs text-gray-500">@ {round2(sellPrice).toFixed(2)}</span>
                        <span className="text-sm font-semibold text-gray-900">{round2(p.quantity * sellPrice).toFixed(2)}</span>
                        <button onClick={() => setPartsLines(partsLines.filter((_, j) => j !== i))} className="text-red-500 text-xs font-semibold">Remove</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="grid grid-cols-12 gap-2">
                <input value={newPart.partName} onChange={(e) => setNewPart({ ...newPart, partName: e.target.value })}
                  placeholder="Part name" className="col-span-4 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input type="number" value={newPart.quantity} onChange={(e) => setNewPart({ ...newPart, quantity: Number(e.target.value) })}
                  placeholder="Qty" min="1" className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input type="number" value={newPart.unitCost} onChange={(e) => setNewPart({ ...newPart, unitCost: Number(e.target.value) })}
                  placeholder="Unit cost" min="0" className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <input type="number" value={newPart.markupPct} onChange={(e) => setNewPart({ ...newPart, markupPct: Number(e.target.value) })}
                  placeholder="Markup %" min="0" className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                <button onClick={addPartsLine} disabled={!newPart.partName.trim()}
                  className="col-span-2 rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
                  Add
                </button>
              </div>
            </div>

            {/* Quick add from catalog */}
            {allCatalog.length > 0 && (() => {
              const isBody = (cat: string | null) => cat ? BODY_CATEGORIES.includes(cat) : false;
              const isMech = (cat: string | null) => !cat || !BODY_CATEGORIES.includes(cat);
              const q = catalogSearch.trim().toLowerCase();
              const filtered = allCatalog.filter((i) => {
                const matchesCategory = repairFilter === 'quick'
                  ? !!i.quick_access
                  : repairFilter === 'body'
                    ? isBody(i.category)
                    : isMech(i.category) && !i.quick_access;
                if (!matchesCategory) return false;
                if (!q) return true;
                return (
                  i.name.toLowerCase().includes(q)
                  || (i.code?.toLowerCase().includes(q) ?? false)
                  || (i.category?.toLowerCase().includes(q) ?? false)
                );
              });
              const FILTERS: { key: RepairFilter; label: string; icon: string }[] = [
                { key: 'quick', label: 'Quick Service', icon: '⚡' },
                { key: 'mechanic', label: 'Mechanic', icon: '🔧' },
                { key: 'body', label: 'Body & Paint', icon: '🎨' },
              ];
              return (
                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                  <h3 className="text-base font-bold text-gray-900 mb-3">Add from Repair Catalog</h3>

                  {/* Repair category filter */}
                  <div className="mb-3 flex gap-1 rounded-xl bg-gray-100 p-1">
                    {FILTERS.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setRepairFilter(f.key)}
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                          repairFilter === f.key
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <span className="me-1.5">{f.icon}</span>{f.label}
                      </button>
                    ))}
                  </div>

                  {/* Search */}
                  <div className="relative mb-3">
                    <input
                      value={catalogSearch}
                      onChange={(e) => setCatalogSearch(e.target.value)}
                      placeholder="Search by name, code, or category…"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pe-9 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                    {catalogSearch && (
                      <button
                        type="button"
                        onClick={() => setCatalogSearch('')}
                        className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {filtered.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">
                        {q ? `No items match "${catalogSearch.trim()}"` : 'No items in this category'}
                      </p>
                    ) : (
                      filtered.map((item) => (
                        <button key={item.id} onClick={() => {
                          setLabourLines([...labourLines, {
                            description: item.name,
                            hours: item.estimated_hours ?? 1,
                            rate: 0,
                          }]);
                        }}
                          className="w-full text-start rounded-lg border border-gray-100 px-3 py-2.5 hover:border-primary-300 hover:bg-primary-50 text-sm">
                          <span className="font-medium text-gray-900">{item.name}</span>
                          {item.estimated_hours && <span className="ms-2 text-xs text-gray-400">{item.estimated_hours}h</span>}
                          {item.category && <span className="ms-2 text-xs text-gray-300">{item.category}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Running total */}
            <div className="rounded-xl bg-gray-100 p-4 text-end">
              <div className="text-sm text-gray-500">Labour: {round2(labourTotal).toFixed(2)}</div>
              <div className="text-sm text-gray-500">Parts: {round2(partsTotal).toFixed(2)}</div>
              <div className="text-sm text-gray-500">Tax ({taxRate}%): {round2(taxAmount).toFixed(2)}</div>
              <div className="text-lg font-bold text-gray-900 mt-1">Total: {round2(grandTotal).toFixed(2)}</div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review & Create ── */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Review Estimate</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Customer</p>
                  <p className="font-semibold text-gray-900">{selectedCustomer?.full_name}</p>
                  <p className="text-sm text-gray-500">{selectedCustomer?.phone}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Vehicle</p>
                  <p className="font-mono font-bold text-gray-900">{selectedVehicle?.plate}</p>
                  <p className="text-sm text-gray-500">{selectedVehicle?.make} {selectedVehicle?.model}</p>
                </div>
                {reportedProblem && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-gray-400 uppercase">Reported Problem</p>
                    <p className="text-gray-900 mt-1">{reportedProblem}</p>
                  </div>
                )}
              </div>

              {/* Lines summary */}
              {labourLines.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">Labour ({labourLines.length})</p>
                  {labourLines.map((l, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span className="text-gray-700">{l.description} ({l.hours}h @ {l.rate})</span>
                      <span className="font-medium">{round2(l.hours * l.rate).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              {partsLines.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">Parts ({partsLines.length})</p>
                  {partsLines.map((p, i) => {
                    const sell = p.unitCost * (1 + p.markupPct / 100);
                    return (
                      <div key={i} className="flex justify-between text-sm py-1">
                        <span className="text-gray-700">{p.partName} (x{p.quantity})</span>
                        <span className="font-medium">{round2(p.quantity * sell).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Totals */}
              <div className="mt-4 pt-4 border-t border-gray-200 text-end">
                <div className="text-sm text-gray-500">Subtotal: {round2(subtotal).toFixed(2)}</div>
                <div className="text-sm text-gray-500">Tax ({taxRate}%): {round2(taxAmount).toFixed(2)}</div>
                <div className="text-xl font-bold text-gray-900 mt-1">Total: {round2(grandTotal).toFixed(2)}</div>
              </div>
            </div>

            {/* Terms & Validity */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Terms & Conditions</label>
                  <textarea value={terms} onChange={(e) => setTerms(e.target.value)}
                    rows={2} placeholder="Optional terms..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Valid Until</label>
                  <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full rounded-xl bg-green-600 py-4 text-lg font-bold text-white hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-200 transition-all">
              {submitting ? 'Creating Estimate...' : 'Create Estimate'}
            </button>
          </div>
        )}

        {/* Navigation */}
        {step !== 'review' && (
          <div className="mt-8 flex items-center justify-between">
            {stepIndex > 0 ? (
              <button onClick={goBack} className="rounded-xl border-2 border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:border-gray-300">Back</button>
            ) : <div />}
            <button onClick={goNext} disabled={!canNext()}
              className="rounded-xl bg-primary-600 px-8 py-3 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-40 shadow-md transition-all">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
