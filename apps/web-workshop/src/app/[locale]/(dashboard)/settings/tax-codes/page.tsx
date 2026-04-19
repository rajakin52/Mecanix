'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';
import { useToast } from '@mecanix/ui-web';

interface TaxCode {
  id: string;
  code: string;
  name: string;
  rate: number;
  is_default: boolean;
  is_active: boolean;
}

interface FormState {
  id?: string;
  code: string;
  name: string;
  rate: string;
  is_default: boolean;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  code: '',
  name: '',
  rate: '',
  is_default: false,
  is_active: true,
};

export default function TaxCodesPage() {
  const toast = useToast();
  const [list, setList] = useState<TaxCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<TaxCode[]>('/tax-codes');
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load tax codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onEdit = (t: TaxCode) => {
    setForm({
      id: t.id,
      code: t.code,
      name: t.name,
      rate: String(t.rate),
      is_default: t.is_default,
      is_active: t.is_active,
    });
    setShowForm(true);
  };

  const onNew = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const onSave = async () => {
    const rateNum = Number(form.rate);
    if (!form.code.trim() || !form.name.trim() || !Number.isFinite(rateNum)) {
      toast.error('Code, name and rate are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        rate: rateNum,
        isDefault: form.is_default,
        isActive: form.is_active,
      };
      if (form.id) {
        await api.patch(`/tax-codes/${form.id}`, payload);
        toast.success('Tax code updated');
      } else {
        await api.post('/tax-codes', payload);
        toast.success('Tax code created');
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (t: TaxCode) => {
    if (!confirm(`Delete tax code "${t.code}"? If it's in use, you should deactivate instead.`)) return;
    try {
      await api.delete(`/tax-codes/${t.id}`);
      toast.success('Tax code deleted');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-sm text-gray-500 hover:text-gray-700">&larr; Settings</Link>
          <h1 className="text-2xl font-bold text-gray-900">Tax Codes (IVA)</h1>
        </div>
        <button
          onClick={onNew}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          + New Tax Code
        </button>
      </div>

      <p className="mb-6 text-sm text-gray-600 max-w-2xl">
        VAT classifications used across parts, services and invoicing. Set the default code that new items inherit. Mark a code inactive to stop it appearing in dropdowns without deleting history.
      </p>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Code</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Rate %</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Default</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500">Active</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                    No tax codes yet.
                  </td>
                </tr>
              ) : list.map((t) => (
                <tr key={t.id} className={t.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-mono text-gray-900">{t.code}</td>
                  <td className="px-4 py-3 text-gray-700">{t.name}</td>
                  <td className="px-4 py-3 text-end text-gray-900">{Number(t.rate).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">{t.is_default ? '★' : ''}</td>
                  <td className="px-4 py-3 text-center">{t.is_active ? '✓' : '✗'}</td>
                  <td className="px-4 py-3 text-end">
                    <button
                      onClick={() => onEdit(t)}
                      className="text-xs text-primary-600 hover:underline me-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(t)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-8" onClick={() => setShowForm(false)}>
          <div
            className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              {form.id ? 'Edit tax code' : 'New tax code'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Code</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="IVA14"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="IVA Normal 14%"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.rate}
                  onChange={(e) => setForm({ ...form, rate: e.target.value })}
                  placeholder="14"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                />
                Default for new items
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={onSave}
                disabled={saving}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
