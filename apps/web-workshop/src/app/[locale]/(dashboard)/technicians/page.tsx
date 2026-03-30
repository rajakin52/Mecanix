'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Technician {
  id: string;
  full_name: string;
  phone: string | null;
  specializations: string[];
  hourly_rate: number | null;
  is_active: boolean;
  created_at: string;
}

export default function TechniciansPage() {
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['technicians'],
    queryFn: () => api.get<Technician[]>('/technicians'),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<Technician>('/technicians', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['technicians'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown> & { id: string }) => api.patch<Technician>(`/technicians/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['technicians'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/technicians/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['technicians'] }),
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: '', phone: '', specializations: '', hourlyRate: '' });
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = () => {
    setForm({ fullName: '', phone: '', specializations: '', hourlyRate: '' });
    setEditId(null);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) return;
    setFormError(null);
    const body = {
      fullName: form.fullName.trim(),
      phone: form.phone || undefined,
      specializations: form.specializations ? form.specializations.split(',').map((s) => s.trim()).filter(Boolean) : [],
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
    };

    try {
      if (editId) {
        await updateMutation.mutateAsync({ id: editId, ...body });
      } else {
        await createMutation.mutateAsync(body);
      }
      setShowForm(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save technician');
    }
  };

  const startEdit = (tech: Technician) => {
    setForm({
      fullName: tech.full_name ?? '',
      phone: tech.phone ?? '',
      specializations: (tech.specializations ?? []).join(', '),
      hourlyRate: tech.hourly_rate ? String(tech.hourly_rate) : '',
    });
    setEditId(tech.id);
    setShowForm(true);
  };

  const techs = Array.isArray(data) ? data : [];

  if (isLoading) return <p className="text-gray-500">{tc('loading')}</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Technicians</h1>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700">
          + New Technician
        </button>
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Name</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Phone</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Specializations</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Rate/hr</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {techs.length > 0 ? techs.map((tech) => (
              <tr key={tech.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{tech.full_name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{tech.phone ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{tech.specializations?.join(', ') || '-'}</td>
                <td className="px-4 py-3 text-end text-sm text-gray-700">{tech.hourly_rate ? Number(tech.hourly_rate).toFixed(2) : '-'}</td>
                <td className="px-4 py-3 text-end">
                  <button onClick={() => startEdit(tech)} className="text-xs text-primary-600 hover:text-primary-700 me-3">Edit</button>
                  <button onClick={() => { if (confirm('Delete this technician?')) deleteMutation.mutate(tech.id); }} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No technicians yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editId ? 'Edit Technician' : 'New Technician'}</h2>
              <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. John Doe" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Specializations</label>
                  <input value={form.specializations} onChange={(e) => setForm({ ...form, specializations: e.target.value })} placeholder="Engine, Electrical, Brakes" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                  <p className="mt-1 text-xs text-gray-400">Comma-separated</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Hourly Rate</label>
                  <input type="number" step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-1 focus:ring-primary-500" />
                </div>
              </div>
              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => { setShowForm(false); resetForm(); }} className="rounded-md border px-4 py-2 text-sm text-gray-600">{tc('cancel')}</button>
                <button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                  {(createMutation.isPending || updateMutation.isPending) ? tc('loading') : tc('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
