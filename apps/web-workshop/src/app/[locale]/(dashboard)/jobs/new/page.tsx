'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

// ── Types ────────────────────────────────────────────────────
interface Customer { id: string; full_name: string; phone: string; email: string | null }
interface Vehicle { id: string; plate: string; make: string; model: string; year: number | null; vin: string | null; customer_id: string }
interface Make { id: string; name: string; country: string | null }
interface Model { id: string; name: string; body_type: string | null }
interface DviItem { name: string; category: string; status: string; notes: string }
interface DamageEntry { location: string; type: string; description: string }
interface CatalogItem { id: string; name: string; code: string | null; category: string | null; type: string; estimated_hours: number | null; quick_access: boolean }

type Step = 'entry' | 'vehicle' | 'inspection' | 'problem' | 'repairs' | 'review';

const STEPS: { key: Step; label: string }[] = [
  { key: 'entry', label: 'Vehicle & Customer' },
  { key: 'inspection', label: 'Inspection' },
  { key: 'problem', label: 'Problem' },
  { key: 'repairs', label: 'Repair Items' },
  { key: 'review', label: 'Review & Create' },
];

const FUEL_LEVELS = ['empty', 'quarter', 'half', 'three_quarter', 'full'] as const;

const DEFAULT_DVI: DviItem[] = [
  { name: 'Brake Pads - Front', category: 'brakes', status: 'not_inspected', notes: '' },
  { name: 'Brake Pads - Rear', category: 'brakes', status: 'not_inspected', notes: '' },
  { name: 'Brake Discs', category: 'brakes', status: 'not_inspected', notes: '' },
  { name: 'Engine Oil', category: 'engine', status: 'not_inspected', notes: '' },
  { name: 'Coolant', category: 'engine', status: 'not_inspected', notes: '' },
  { name: 'Drive Belts', category: 'engine', status: 'not_inspected', notes: '' },
  { name: 'Battery', category: 'electrical', status: 'not_inspected', notes: '' },
  { name: 'Shocks - Front', category: 'suspension', status: 'not_inspected', notes: '' },
  { name: 'Shocks - Rear', category: 'suspension', status: 'not_inspected', notes: '' },
  { name: 'Tires - FL', category: 'tires', status: 'not_inspected', notes: '' },
  { name: 'Tires - FR', category: 'tires', status: 'not_inspected', notes: '' },
  { name: 'Tires - RL', category: 'tires', status: 'not_inspected', notes: '' },
  { name: 'Tires - RR', category: 'tires', status: 'not_inspected', notes: '' },
  { name: 'Headlights', category: 'lights', status: 'not_inspected', notes: '' },
  { name: 'Wipers', category: 'body', status: 'not_inspected', notes: '' },
  { name: 'A/C System', category: 'hvac', status: 'not_inspected', notes: '' },
  { name: 'Exhaust', category: 'exhaust', status: 'not_inspected', notes: '' },
];

// ── Component ────────────────────────────────────────────────
export default function NewJobWizard() {
  const tc = useTranslations('common');
  const router = useRouter();

  // Step management
  const [step, setStep] = useState<Step>('entry');
  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // Entry mode
  const [entryMode, setEntryMode] = useState<'vehicle' | 'customer' | null>(null);

  // Customer & Vehicle
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [plateSearch, setPlateSearch] = useState('');

  // New vehicle form
  const [showNewVehicle, setShowNewVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ plate: '', vin: '', makeId: '', make: '', model: '', year: '', color: '', fuelType: 'diesel' });
  const [selectedMakeId, setSelectedMakeId] = useState('');

  // Inspection
  const [mileage, setMileage] = useState('');
  const [fuelLevel, setFuelLevel] = useState('');
  const [dviItems, setDviItems] = useState<DviItem[]>([...DEFAULT_DVI]);
  const [damages, setDamages] = useState<DamageEntry[]>([]);

  // Problem
  const [reportedProblem, setReportedProblem] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // Repair items
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Set<string>>(new Set());

  // Submitting
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ── Data fetching ──
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

  const { data: makes } = useQuery({
    queryKey: ['vehicle-makes'],
    queryFn: () => api.get<Make[]>('/vehicle-lookup/makes'),
  });

  const { data: models } = useQuery({
    queryKey: ['vehicle-models', selectedMakeId],
    queryFn: () => api.get<Model[]>(`/vehicle-lookup/makes/${selectedMakeId}/models`),
    enabled: !!selectedMakeId,
  });

  const { data: catalogData } = useQuery({
    queryKey: ['catalog-quick'],
    queryFn: () => api.get<CatalogItem[]>('/catalog?quickAccess=true'),
  });

  const { data: allCatalogData } = useQuery({
    queryKey: ['catalog-all'],
    queryFn: () => api.get<CatalogItem[]>('/catalog'),
  });

  // Unwrap paginated responses
  const customerList = Array.isArray(customers) ? customers : (customers as { data: Customer[] } | undefined)?.data ?? [];
  const vehicleList = Array.isArray(customerVehicles) ? customerVehicles : (customerVehicles as { data: Vehicle[] } | undefined)?.data ?? [];
  const makesList = Array.isArray(makes) ? makes : [];
  const modelsList = Array.isArray(models) ? models : [];
  const quickCatalog = Array.isArray(catalogData) ? catalogData : [];
  const allCatalog = Array.isArray(allCatalogData) ? allCatalogData : [];

  // ── Vehicle plate search ──
  const handlePlateSearch = async () => {
    if (!plateSearch.trim()) return;
    try {
      const data = await api.get<{ data: Vehicle[] } | Vehicle[]>(`/vehicles?search=${encodeURIComponent(plateSearch)}&pageSize=5`);
      const list = Array.isArray(data) ? data : (data as { data: Vehicle[] }).data ?? [];
      if (list.length > 0) {
        setSelectedVehicle(list[0]!);
        // Auto-fill customer
        if (list[0]!.customer_id) {
          try {
            const cust = await api.get<Customer>(`/customers/${list[0]!.customer_id}`);
            setSelectedCustomer(cust);
          } catch { /* ignore */ }
        }
      } else {
        setShowNewVehicle(true);
        setNewVehicle((v) => ({ ...v, plate: plateSearch.toUpperCase() }));
      }
    } catch { /* ignore */ }
  };

  // ── Create new vehicle inline ──
  const handleCreateVehicle = async () => {
    if (!newVehicle.plate || !newVehicle.vin || !newVehicle.make) return;
    if (!selectedCustomer) { setError('Select a customer first'); return; }
    try {
      const vehicle = await api.post<Vehicle>('/vehicles', {
        customerId: selectedCustomer.id,
        plate: newVehicle.plate,
        vin: newVehicle.vin,
        make: newVehicle.make,
        model: newVehicle.model,
        year: newVehicle.year ? Number(newVehicle.year) : undefined,
        color: newVehicle.color || undefined,
        fuelType: newVehicle.fuelType || undefined,
      });
      setSelectedVehicle(vehicle);
      setShowNewVehicle(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vehicle');
    }
  };

  // ── DVI helpers ──
  const setDviStatus = (idx: number, status: string) => {
    setDviItems((prev) => prev.map((item, i) =>
      i === idx ? { ...item, status: item.status === status ? 'not_inspected' : status } : item,
    ));
  };

  // ── Toggle catalog item ──
  const toggleCatalog = (id: string) => {
    setSelectedCatalogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Validation per step ──
  const canNext = (): boolean => {
    switch (step) {
      case 'entry': return !!selectedCustomer && !!selectedVehicle;
      case 'inspection': return !!mileage.trim() && !!fuelLevel;
      case 'problem': return !!reportedProblem.trim();
      case 'repairs': return true; // optional but encouraged
      case 'review': return true;
      default: return false;
    }
  };

  const goNext = () => {
    const idx = stepIndex;
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]!.key);
  };

  const goBack = () => {
    const idx = stepIndex;
    if (idx > 0) setStep(STEPS[idx - 1]!.key);
  };

  // ── Submit everything ──
  const handleSubmit = async () => {
    if (!selectedCustomer || !selectedVehicle) return;
    setSubmitting(true);
    setError('');

    try {
      // 1. Create job card
      const job = await api.post<{ id: string; job_number: string }>('/jobs', {
        customerId: selectedCustomer.id,
        vehicleId: selectedVehicle.id,
        reportedProblem: reportedProblem.trim(),
        internalNotes: internalNotes.trim() || undefined,
      });

      // 2. Create inspection
      const inspectedDvi = dviItems.filter((i) => i.status !== 'not_inspected');
      await api.post('/inspections', {
        jobCardId: job.id,
        vehicleId: selectedVehicle.id,
        mileageIn: Number(mileage) || undefined,
        fuelLevel: fuelLevel || undefined,
        exteriorDamage: damages.length > 0 ? damages : undefined,
        dviItems: inspectedDvi.length > 0 ? inspectedDvi : undefined,
      });

      // 3. Apply selected catalog items
      for (const catalogId of selectedCatalogIds) {
        try {
          await api.post(`/catalog/${catalogId}/apply-to-job/${job.id}`, {});
        } catch { /* non-critical */ }
      }

      // 4. Navigate to job detail
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create job card');
      setSubmitting(false);
    }
  };

  // ── Progress bar ──
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link href="/jobs" className="text-sm text-gray-500 hover:text-gray-700">&larr; Back to Jobs</Link>
          <h1 className="text-xl font-bold text-gray-900">New Job Card</h1>
          <div className="w-20" />
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 px-6 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                onClick={() => i <= stepIndex && setStep(s.key)}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  i < stepIndex ? 'text-green-600 cursor-pointer' :
                  i === stepIndex ? 'text-primary-600' : 'text-gray-400'
                }`}
              >
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
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {/* ── STEP: Vehicle & Customer ── */}
        {step === 'entry' && (
          <div className="space-y-6">
            {!entryMode && (
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">How would you like to start?</h2>
                <p className="text-gray-500 mb-8">Choose vehicle or customer to begin the job card</p>
                <div className="flex justify-center gap-6">
                  <button onClick={() => setEntryMode('vehicle')}
                    className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white p-8 hover:border-primary-500 hover:shadow-lg transition-all w-56">
                    <span className="text-4xl">&#128663;</span>
                    <span className="text-lg font-bold text-gray-900 group-hover:text-primary-600">Vehicle First</span>
                    <span className="text-xs text-gray-500">Search by plate or VIN</span>
                  </button>
                  <button onClick={() => setEntryMode('customer')}
                    className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white p-8 hover:border-primary-500 hover:shadow-lg transition-all w-56">
                    <span className="text-4xl">&#128100;</span>
                    <span className="text-lg font-bold text-gray-900 group-hover:text-primary-600">Customer First</span>
                    <span className="text-xs text-gray-500">Search by name or phone</span>
                  </button>
                </div>
              </div>
            )}

            {/* Vehicle first */}
            {entryMode === 'vehicle' && !selectedVehicle && (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Find Vehicle</h3>
                <div className="flex gap-2">
                  <input value={plateSearch} onChange={(e) => setPlateSearch(e.target.value.toUpperCase())}
                    placeholder="Enter plate number or VIN..."
                    onKeyDown={(e) => e.key === 'Enter' && handlePlateSearch()}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-lg font-mono focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                  <button onClick={handlePlateSearch} className="rounded-lg bg-primary-600 px-6 py-3 font-semibold text-white hover:bg-primary-700">Search</button>
                </div>
                <button onClick={() => { setShowNewVehicle(true); setEntryMode('customer'); }} className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                  + Register New Vehicle
                </button>
              </div>
            )}

            {/* Customer first */}
            {entryMode === 'customer' && !selectedCustomer && (
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

            {/* Selected customer → pick vehicle */}
            {selectedCustomer && !selectedVehicle && (
              <div className="space-y-4">
                <div className="rounded-xl bg-green-50 border border-green-200 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs text-green-600 font-semibold uppercase">Customer</span>
                    <p className="font-bold text-green-900">{selectedCustomer.full_name}</p>
                    <p className="text-sm text-green-700">{selectedCustomer.phone}</p>
                  </div>
                  <button onClick={() => { setSelectedCustomer(null); setEntryMode('customer'); }} className="text-xs text-green-600 hover:text-green-800">Change</button>
                </div>

                <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Select Vehicle</h3>
                  <input
                    placeholder="Search by plate, make or model..."
                    onChange={(e) => {
                      const q = e.target.value.toLowerCase();
                      // Filter is done inline below
                      (e.target as HTMLInputElement).dataset.filter = q;
                      // Force re-render by setting a dummy state
                      setPlateSearch(q);
                    }}
                    className="mb-3 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  />
                  {vehicleList.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {vehicleList
                        .filter((v) => {
                          if (!plateSearch) return true;
                          const q = plateSearch.toLowerCase();
                          return v.plate.toLowerCase().includes(q) ||
                            v.make.toLowerCase().includes(q) ||
                            v.model.toLowerCase().includes(q) ||
                            (v.vin ?? '').toLowerCase().includes(q);
                        })
                        .map((v) => (
                        <button key={v.id} onClick={() => setSelectedVehicle(v)}
                          className="w-full text-start rounded-lg border-2 border-gray-200 px-4 py-3 hover:border-primary-500 hover:bg-primary-50 transition-all">
                          <span className="text-lg font-mono font-bold text-gray-900">{v.plate}</span>
                          <span className="ms-3 text-sm text-gray-600">{v.make} {v.model} {v.year ? `(${v.year})` : ''}</span>
                          {v.vin && <span className="ms-2 text-xs text-gray-400 font-mono">{v.vin}</span>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 mb-3">No vehicles found for this customer.</p>
                  )}
                  <button onClick={() => setShowNewVehicle(true)} className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                    + Register New Vehicle
                  </button>
                </div>
              </div>
            )}

            {/* New vehicle inline form */}
            {showNewVehicle && (
              <div className="rounded-xl bg-white p-6 shadow-sm border-2 border-primary-200">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Register New Vehicle</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Plate *</label>
                    <input value={newVehicle.plate} onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">VIN *</label>
                    <input value={newVehicle.vin} onChange={(e) => setNewVehicle({ ...newVehicle, vin: e.target.value.toUpperCase() })}
                      maxLength={17}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Brand *</label>
                    <select value={selectedMakeId} onChange={(e) => {
                      const id = e.target.value;
                      setSelectedMakeId(id);
                      const make = makesList.find((m) => m.id === id);
                      setNewVehicle({ ...newVehicle, makeId: id, make: make?.name ?? '' });
                    }} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 bg-white">
                      <option value="">— Select Brand —</option>
                      {makesList.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Model *</label>
                    <select value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 bg-white">
                      <option value="">— Select Model —</option>
                      {modelsList.map((m) => <option key={m.id} value={m.name}>{m.name} {m.body_type ? `(${m.body_type})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Year</label>
                    <input type="number" value={newVehicle.year} onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })}
                      min="1990" max="2030" className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Color</label>
                    <input value={newVehicle.color} onChange={(e) => setNewVehicle({ ...newVehicle, color: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={handleCreateVehicle} disabled={!newVehicle.plate || !newVehicle.vin || !newVehicle.make}
                    className="rounded-lg bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-40">
                    Create Vehicle
                  </button>
                  <button onClick={() => setShowNewVehicle(false)} className="rounded-lg border px-4 py-2 text-sm text-gray-600">Cancel</button>
                </div>
              </div>
            )}

            {/* Both selected */}
            {selectedCustomer && selectedVehicle && (
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-green-50 border border-green-200 p-4">
                  <span className="text-xs text-green-600 font-semibold uppercase">Customer</span>
                  <p className="font-bold text-green-900">{selectedCustomer.full_name}</p>
                  <p className="text-sm text-green-700">{selectedCustomer.phone}</p>
                  <button onClick={() => { setSelectedCustomer(null); setSelectedVehicle(null); setEntryMode(null); }} className="mt-2 text-xs text-green-600 hover:text-green-800">Change</button>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
                  <span className="text-xs text-blue-600 font-semibold uppercase">Vehicle</span>
                  <p className="font-bold font-mono text-blue-900">{selectedVehicle.plate}</p>
                  <p className="text-sm text-blue-700">{selectedVehicle.make} {selectedVehicle.model}</p>
                  <button onClick={() => { setSelectedVehicle(null); }} className="mt-2 text-xs text-blue-600 hover:text-blue-800">Change</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: Inspection ── */}
        {step === 'inspection' && (
          <div className="space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Vehicle Condition</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Odometer (km) *</label>
                  <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Fuel Level *</label>
                  <div className="flex gap-2">
                    {FUEL_LEVELS.map((level) => (
                      <button key={level} onClick={() => setFuelLevel(level)}
                        className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                          fuelLevel === level ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}>
                        {level.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* DVI Traffic Light */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-2">DVI Inspection</h3>
              <div className="flex gap-4 mb-4 text-xs">
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-green-500 inline-block" /> Good</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-yellow-500 inline-block" /> Monitor</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-red-500 inline-block" /> Urgent</span>
              </div>
              {[...new Set(dviItems.map((i) => i.category))].map((cat) => (
                <div key={cat} className="mb-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">{cat}</p>
                  {dviItems.map((item, idx) => {
                    if (item.category !== cat) return null;
                    const bg = item.status === 'green' ? 'bg-green-50 border-green-200' : item.status === 'yellow' ? 'bg-yellow-50 border-yellow-200' : item.status === 'red' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200';
                    return (
                      <div key={idx} className={`flex items-center gap-3 rounded-lg border px-3 py-2 mb-1 ${bg}`}>
                        <span className="text-sm font-medium text-gray-700 flex-1">{item.name}</span>
                        {(['green', 'yellow', 'red'] as const).map((s) => (
                          <button key={s} onClick={() => setDviStatus(idx, s)}
                            className={`h-6 w-6 rounded-full transition-all ${
                              item.status === s ? `${s === 'green' ? 'bg-green-500' : s === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'} ring-2 ring-offset-1 ring-${s === 'green' ? 'green' : s === 'yellow' ? 'yellow' : 'red'}-300` :
                              `${s === 'green' ? 'bg-green-200' : s === 'yellow' ? 'bg-yellow-200' : 'bg-red-200'} opacity-40 hover:opacity-80`
                            }`} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="mt-3 flex gap-3 text-xs font-semibold">
                <span className="text-green-600">{dviItems.filter((i) => i.status === 'green').length} Good</span>
                <span className="text-yellow-600">{dviItems.filter((i) => i.status === 'yellow').length} Monitor</span>
                <span className="text-red-600">{dviItems.filter((i) => i.status === 'red').length} Urgent</span>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: Problem Description ── */}
        {step === 'problem' && (
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Problem Description</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700">Customer Complaint *</label>
              <textarea value={reportedProblem} onChange={(e) => setReportedProblem(e.target.value)}
                rows={4} placeholder="Describe the issue reported by the customer..."
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Internal Notes</label>
              <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)}
                rows={2} placeholder="Workshop-only notes (not visible to customer)"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3" />
            </div>
          </div>
        )}

        {/* ── STEP: Repair Items ── */}
        {step === 'repairs' && (() => {
          const BODY_CATEGORIES = ['Body Repair'];
          const isMech = (cat: string | null) => !cat || !BODY_CATEGORIES.includes(cat);
          const isBody = (cat: string | null) => cat ? BODY_CATEGORIES.includes(cat) : false;

          return (
          <div className="space-y-6">
            {/* Mechanical / Body toggle */}
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
              <button onClick={() => setPlateSearch('mechanical')}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  plateSearch !== 'body' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                Mechanical
              </button>
              <button onClick={() => setPlateSearch('body')}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
                  plateSearch === 'body' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                Body Shop
              </button>
            </div>

            {/* Quick Access */}
            {quickCatalog.filter((i) => plateSearch === 'body' ? isBody(i.category) : isMech(i.category)).length > 0 && (
              <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 mb-3">Quick Access</h3>
                <div className="grid grid-cols-2 gap-2">
                  {quickCatalog.filter((i) => plateSearch === 'body' ? isBody(i.category) : isMech(i.category)).map((item) => (
                    <label key={item.id} className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 cursor-pointer transition-colors ${
                      selectedCatalogIds.has(item.id) ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                      <input type="checkbox" checked={selectedCatalogIds.has(item.id)} onChange={() => toggleCatalog(item.id)}
                        className="rounded border-gray-300 text-primary-600" />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                        {item.estimated_hours && <span className="ms-2 text-xs text-gray-400">{item.estimated_hours}h</span>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* All Services (filtered) */}
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-3">
                {plateSearch === 'body' ? 'Body Shop Services' : 'Mechanical Services'}
              </h3>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {allCatalog
                  .filter((i) => !i.quick_access)
                  .filter((i) => plateSearch === 'body' ? isBody(i.category) : isMech(i.category))
                  .map((item) => (
                  <label key={item.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer ${
                    selectedCatalogIds.has(item.id) ? 'border-primary-400 bg-primary-50' : 'border-gray-100 hover:border-gray-200'
                  }`}>
                    <input type="checkbox" checked={selectedCatalogIds.has(item.id)} onChange={() => toggleCatalog(item.id)}
                      className="rounded border-gray-300 text-primary-600" />
                    <span className="text-sm text-gray-900 flex-1">{item.name}</span>
                    {item.estimated_hours && <span className="text-xs text-gray-400">{item.estimated_hours}h</span>}
                    {item.category && <span className="text-xs text-gray-300 ms-1">{item.category}</span>}
                  </label>
                ))}
                {allCatalog
                  .filter((i) => !i.quick_access)
                  .filter((i) => plateSearch === 'body' ? isBody(i.category) : isMech(i.category))
                  .length === 0 && (
                  <p className="text-sm text-gray-500 py-4 text-center">No items in this category</p>
                )}
              </div>
            </div>

            {selectedCatalogIds.size > 0 && (
              <div className="text-center text-sm text-primary-600 font-semibold">
                {selectedCatalogIds.size} service{selectedCatalogIds.size > 1 ? 's' : ''} selected
              </div>
            )}
          </div>
          );
        })()}

        {/* ── STEP: Review ── */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Review Job Card</h3>
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
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Odometer</p>
                  <p className="font-semibold text-gray-900">{mileage} km</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Fuel</p>
                  <p className="font-semibold text-gray-900">{fuelLevel.replace('_', ' ')}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">DVI Summary</p>
                  <div className="flex gap-4 mt-1">
                    <span className="text-sm text-green-600 font-medium">{dviItems.filter((i) => i.status === 'green').length} Good</span>
                    <span className="text-sm text-yellow-600 font-medium">{dviItems.filter((i) => i.status === 'yellow').length} Monitor</span>
                    <span className="text-sm text-red-600 font-medium">{dviItems.filter((i) => i.status === 'red').length} Urgent</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-bold text-gray-400 uppercase">Reported Problem</p>
                  <p className="text-gray-900 mt-1">{reportedProblem}</p>
                </div>
                {selectedCatalogIds.size > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-gray-400 uppercase">Repair Items ({selectedCatalogIds.size})</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {[...selectedCatalogIds].map((id) => {
                        const item = allCatalog.find((c) => c.id === id) ?? quickCatalog.find((c) => c.id === id);
                        return item ? <span key={id} className="rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-700">{item.name}</span> : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={submitting}
              className="w-full rounded-xl bg-green-600 py-4 text-lg font-bold text-white hover:bg-green-700 disabled:opacity-50 shadow-lg shadow-green-200 transition-all">
              {submitting ? 'Creating Job Card...' : 'Create Job Card'}
            </button>
          </div>
        )}

        {/* ── Navigation ── */}
        {step !== 'review' && (
          <div className="mt-8 flex items-center justify-between">
            {stepIndex > 0 ? (
              <button onClick={goBack} className="rounded-xl border-2 border-gray-200 px-6 py-3 text-sm font-semibold text-gray-600 hover:border-gray-300">
                Back
              </button>
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
