'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useFleets, useCreateFleet } from '@/hooks/use-fleets';
import { formatCurrency } from '@/lib/format';
import { SkeletonTable, EmptyState, useToast } from '@mecanix/ui-web';

export default function FleetsPage() {
  const toast = useToast();
  const { data, isLoading, isError, error } = useFleets();
  const create = useCreateFleet();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    companyName: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    monthlyBudget: '',
    notes: '',
  });

  const fleets = (data ?? []) as Array<Record<string, unknown>>;

  const handleCreate = async () => {
    if (!form.name) return toast.error('Fleet name is required');
    try {
      await create.mutateAsync({
        name: form.name,
        companyName: form.companyName || undefined,
        contactName: form.contactName || undefined,
        contactPhone: form.contactPhone || undefined,
        contactEmail: form.contactEmail || undefined,
        monthlyBudget: form.monthlyBudget ? Number(form.monthlyBudget) : undefined,
        notes: form.notes || undefined,
      });
      setForm({ name: '', companyName: '', contactName: '', contactPhone: '', contactEmail: '', monthlyBudget: '', notes: '' });
      setShowForm(false);
      toast.success('Fleet created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create fleet');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Fleets</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          New fleet
        </button>
      </div>

      {isLoading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Failed to load: {error instanceof Error ? error.message : 'unknown error'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Fleet</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Company</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Contact</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Vehicles</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Monthly budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {fleets.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState icon="parts" title="No fleets yet" description="Group corporate vehicles into fleets to track spend and PM schedules." />
                  </td>
                </tr>
              ) : (
                fleets.map((f) => (
                  <tr key={f.id as string} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium">
                      <Link href={`/fleets/${f.id as string}`} className="text-primary-600 hover:underline">
                        {f.name as string}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{(f.company_name as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {f.contact_name ? (
                        <>
                          <div>{f.contact_name as string}</div>
                          <div className="text-xs text-gray-500">{(f.contact_phone as string) ?? ''}</div>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-end text-sm text-gray-700">{(f.vehicle_count as number) ?? 0}</td>
                    <td className="px-4 py-3 text-end text-sm text-gray-700">
                      {f.monthly_budget != null ? formatCurrency(Number(f.monthly_budget)) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New fleet</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                &#x2715;
              </button>
            </div>
            <div className="space-y-3">
              <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Company" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact name" value={form.contactName} onChange={(v) => setForm({ ...form, contactName: v })} />
                <Field label="Contact phone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} />
              </div>
              <Field label="Contact email" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} />
              <Field label="Monthly budget" type="number" value={form.monthlyBudget} onChange={(v) => setForm({ ...form, monthlyBudget: v })} />
              <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={create.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {create.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
