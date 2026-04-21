'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useBranches, useCreateBranch, useUpdateBranch, type Branch } from '@/hooks/use-branches';
import { useToast } from '@mecanix/ui-web';

export default function BranchesSettingsPage() {
  const toast = useToast();
  const { data, isLoading } = useBranches();
  const create = useCreateBranch();
  const update = useUpdateBranch();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    isDefault: false,
    notes: '',
  });

  const branches = data ?? [];

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', code: '', address: '', phone: '', email: '', isDefault: false, notes: '' });
    setShowForm(true);
  };

  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({
      name: b.name,
      code: b.code,
      address: b.address ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
      isDefault: b.is_default,
      notes: b.notes ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) return toast.error('Name and code are required');
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...form });
        toast.success('Branch updated');
      } else {
        await create.mutateAsync(form);
        toast.success('Branch created');
      }
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div>
      <div className="mb-4">
        <Link href="/settings" className="text-sm text-primary-600 hover:underline">
          &larr; Settings
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Branches</h1>
          <p className="mt-1 text-sm text-gray-600">
            Physical locations within your workshop. Customers, vehicles, and the parts master are
            shared across all branches. Stock is tracked per warehouse — a branch can have one or
            many warehouses.
          </p>
        </div>
        <button
          onClick={openNew}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          New branch
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : branches.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No branches yet. Your tenant runs as a single location until you add one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Code</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Contact</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Address</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {branches.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-gray-900">
                    {b.code}
                    {b.is_default ? (
                      <span className="ms-2 rounded bg-primary-100 px-1.5 py-0.5 text-xs font-medium text-primary-700">
                        default
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {b.phone ?? ''}
                    {b.phone && b.email ? <span className="mx-1 text-gray-400">·</span> : null}
                    {b.email ?? ''}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{b.address ?? '—'}</td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => openEdit(b)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? 'Edit branch' : 'New branch'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                &#x2715;
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="LAD"
                    maxLength={8}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                Default branch (used when no branch is selected on a job)
              </label>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowForm(false)} className="rounded-md border px-4 py-2 text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={create.isPending || update.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {create.isPending || update.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
