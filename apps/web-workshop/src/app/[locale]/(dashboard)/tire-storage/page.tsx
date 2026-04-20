'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  useTireStorage,
  useTireStorageSummary,
  useCreateTireStorage,
  useChangeTireStorageStatus,
} from '@/hooks/use-tire-storage';
import { formatCurrency, formatDate } from '@/lib/format';
import { SkeletonTable, EmptyState, useToast } from '@mecanix/ui-web';

const SEASONS: Array<{ v: 'summer' | 'winter' | 'all_season'; label: string; color: string }> = [
  { v: 'summer', label: 'Summer', color: 'bg-yellow-100 text-yellow-700' },
  { v: 'winter', label: 'Winter', color: 'bg-blue-100 text-blue-700' },
  { v: 'all_season', label: 'All-season', color: 'bg-gray-100 text-gray-700' },
];

const STATUSES = ['stored', 'fitted', 'returned', 'written_off'];

interface CustomerSummary { id: string; full_name: string; phone?: string }
interface VehicleSummary { id: string; plate: string; make?: string; model?: string; customer_id?: string }

export default function TireStoragePage() {
  const toast = useToast();
  const [status, setStatus] = useState('stored');
  const [season, setSeason] = useState<string>('all');

  const { data, isLoading } = useTireStorage({ status });
  const { data: summary } = useTireStorageSummary();
  const create = useCreateTireStorage();
  const changeStatus = useChangeTireStorageStatus();

  const [showForm, setShowForm] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSummary | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleSummary | null>(null);
  const [form, setForm] = useState({
    storageCode: '',
    tireCount: '4',
    tireBrand: '',
    tireModel: '',
    tireSize: '',
    season: 'winter' as 'summer' | 'winter' | 'all_season',
    treadDepthMm: '',
    wheelIncluded: false,
    notes: '',
    monthlyFee: '',
  });

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const filtered = season === 'all' ? rows : rows.filter((r) => r.season === season);

  const { data: customerResults } = useQuery<{ data: CustomerSummary[] } | CustomerSummary[]>({
    queryKey: ['customers-tire-search', customerSearch],
    queryFn: () =>
      api.get<{ data: CustomerSummary[] } | CustomerSummary[]>(
        `/customers?search=${encodeURIComponent(customerSearch)}&pageSize=10`,
      ),
    enabled: customerSearch.length >= 2 && !selectedCustomer,
  });

  const { data: vehiclesForCustomer } = useQuery<{ data: VehicleSummary[] } | VehicleSummary[]>({
    queryKey: ['vehicles-of-customer', selectedCustomer?.id],
    queryFn: () =>
      api.get<{ data: VehicleSummary[] } | VehicleSummary[]>(
        `/vehicles?customerId=${selectedCustomer!.id}&pageSize=30`,
      ),
    enabled: !!selectedCustomer,
  });

  const flattenList = <T,>(r: { data?: T[] } | T[] | undefined): T[] =>
    Array.isArray(r) ? r : Array.isArray(r?.data) ? r!.data! : [];
  const customerList = flattenList<CustomerSummary>(customerResults);
  const vehicleList = flattenList<VehicleSummary>(vehiclesForCustomer);

  const handleCreate = async () => {
    if (!selectedCustomer) return toast.error('Pick a customer first');
    try {
      await create.mutateAsync({
        customerId: selectedCustomer.id,
        vehicleId: selectedVehicle?.id,
        storageCode: form.storageCode || undefined,
        tireCount: Number(form.tireCount) || 4,
        tireBrand: form.tireBrand || undefined,
        tireModel: form.tireModel || undefined,
        tireSize: form.tireSize || undefined,
        season: form.season,
        treadDepthMm: form.treadDepthMm ? Number(form.treadDepthMm) : undefined,
        wheelIncluded: form.wheelIncluded,
        notes: form.notes || undefined,
        monthlyFee: form.monthlyFee ? Number(form.monthlyFee) : 0,
      });
      setShowForm(false);
      setSelectedCustomer(null);
      setSelectedVehicle(null);
      setCustomerSearch('');
      setForm({ storageCode: '', tireCount: '4', tireBrand: '', tireModel: '', tireSize: '', season: 'winter', treadDepthMm: '', wheelIncluded: false, notes: '', monthlyFee: '' });
      toast.success('Tires stored');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleStatus = async (id: string, to: 'stored' | 'fitted' | 'returned' | 'written_off') => {
    try {
      await changeStatus.mutateAsync({ id, status: to });
      toast.success(`Marked as ${to.replace('_', ' ')}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tire storage</h1>
          <p className="text-sm text-gray-600">
            Seasonal tire hotel — rack slots, intake condition, pickup events.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Store new set
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Kpi label="Active" value={summary ? String(summary.totalActive) : '…'} />
        <Kpi label="Monthly revenue" value={summary ? formatCurrency(summary.monthlyRevenue) : '…'} color="text-green-700" />
        <Kpi label="Fitted" value={summary ? String(summary.fitted) : '…'} />
        <Kpi label="Returned" value={summary ? String(summary.returned) : '…'} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {['all', 'summer', 'winter', 'all_season'].map((s) => (
            <button
              key={s}
              onClick={() => setSeason(s)}
              className={`rounded px-3 py-1 text-xs font-medium ${
                season === s ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="parts"
          title="No tires currently stored"
          description="Add a set from the button above. Each entry locks a rack slot and starts the monthly fee clock."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase text-gray-500">Code</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase text-gray-500">Customer / Vehicle</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase text-gray-500">Set</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase text-gray-500">Season</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase text-gray-500">Stored</th>
                <th className="px-3 py-3 text-end text-xs font-semibold uppercase text-gray-500">Monthly</th>
                <th className="px-3 py-3 text-end text-xs font-semibold uppercase text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map((r) => {
                const c = r.customer as Record<string, unknown> | null;
                const v = r.vehicle as Record<string, unknown> | null;
                const seasonOpt = SEASONS.find((s) => s.v === r.season);
                const isStored = r.status === 'stored';
                return (
                  <tr key={r.id as string} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm font-mono text-gray-900">{(r.storage_code as string) ?? '—'}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">{(c?.full_name as string) ?? '—'}</div>
                      {v ? (
                        <div className="text-xs text-gray-500">
                          <span className="font-mono">{v.plate as string}</span>
                          <span className="ms-1">
                            {(v.make as string) ?? ''} {(v.model as string) ?? ''}
                          </span>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <div>
                        {(r.tire_count as number) ?? 4}× {(r.tire_size as string) ?? ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(r.tire_brand as string) ?? ''} {(r.tire_model as string) ?? ''}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {seasonOpt ? (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${seasonOpt.color}`}>
                          {seasonOpt.label}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-600">{formatDate(r.stored_at as string)}</td>
                    <td className="px-3 py-3 text-end text-sm text-gray-700">
                      {formatCurrency(Number(r.monthly_fee) || 0)}
                    </td>
                    <td className="px-3 py-3 text-end">
                      {isStored ? (
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => handleStatus(r.id as string, 'fitted')}
                            className="rounded-md border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                          >
                            Fitted
                          </button>
                          <button
                            onClick={() => handleStatus(r.id as string, 'returned')}
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Returned
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">{r.status as string}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Store new set</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                &#x2715;
              </button>
            </div>

            {/* Customer picker */}
            {!selectedCustomer ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Customer</label>
                <input
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search by name or phone…"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {customerList.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-gray-200">
                    {customerList.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerSearch('');
                        }}
                        className="block w-full border-b border-gray-100 px-3 py-2 text-start text-sm hover:bg-gray-50 last:border-0"
                      >
                        <div className="font-medium text-gray-900">{c.full_name}</div>
                        <div className="text-xs text-gray-500">{c.phone ?? ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
                <span className="font-medium text-gray-900">{selectedCustomer.full_name}</span>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setSelectedVehicle(null);
                  }}
                  className="ms-2 text-xs text-primary-600 hover:underline"
                >
                  change
                </button>
              </div>
            )}

            {/* Vehicle picker (optional) */}
            {selectedCustomer && vehicleList.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Vehicle (optional)</label>
                <select
                  value={selectedVehicle?.id ?? ''}
                  onChange={(e) =>
                    setSelectedVehicle(vehicleList.find((v) => v.id === e.target.value) ?? null)
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">—</option>
                  {vehicleList.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} {v.make ?? ''} {v.model ?? ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Rack code" value={form.storageCode} onChange={(v) => setForm({ ...form, storageCode: v })} placeholder="R3-B-04" />
              <Field label="Tire count" value={form.tireCount} onChange={(v) => setForm({ ...form, tireCount: v })} type="number" />
              <Field label="Brand" value={form.tireBrand} onChange={(v) => setForm({ ...form, tireBrand: v })} />
              <Field label="Model" value={form.tireModel} onChange={(v) => setForm({ ...form, tireModel: v })} />
              <Field label="Size" value={form.tireSize} onChange={(v) => setForm({ ...form, tireSize: v })} placeholder="205/55 R16" />
              <div>
                <label className="block text-sm font-medium text-gray-700">Season</label>
                <select
                  value={form.season}
                  onChange={(e) => setForm({ ...form, season: e.target.value as 'summer' | 'winter' | 'all_season' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="summer">Summer</option>
                  <option value="winter">Winter</option>
                  <option value="all_season">All-season</option>
                </select>
              </div>
              <Field label="Tread depth (mm)" value={form.treadDepthMm} onChange={(v) => setForm({ ...form, treadDepthMm: v })} type="number" />
              <Field label="Monthly fee" value={form.monthlyFee} onChange={(v) => setForm({ ...form, monthlyFee: v })} type="number" />
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.wheelIncluded}
                onChange={(e) => setForm({ ...form, wheelIncluded: e.target.checked })}
              />
              Wheels included
            </label>

            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={create.isPending || !selectedCustomer}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {create.isPending ? 'Saving…' : 'Store'}
              </button>
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
