'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  specialization: string | null;
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
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', specialization: '', hourlyRate: '' });

  const resetForm = () => {
    setForm({ firstName: '', lastName: '', email: '', phone: '', specialization: '', hourlyRate: '' });
    setEditId(null);
  };

  const handleSave = async () => {
    if (!form.firstName.trim()) return;
    const body = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || undefined,
      phone: form.phone || undefined,
      specialization: form.specialization || undefined,
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
    };

    if (editId) {
      await updateMutation.mutateAsync({ id: editId, ...body });
    } else {
      await createMutation.mutateAsync(body);
    }
    setShowForm(false);
    resetForm();
  };

  const startEdit = (tech: Technician) => {
    setForm({
      firstName: tech.first_name ?? '',
      lastName: tech.last_name ?? '',
      email: tech.email ?? '',
      phone: tech.phone ?? '',
      specialization: tech.specialization ?? '',
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
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Email</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Phone</th>
              <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Specialization</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Rate/hr</th>
              <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {techs.length > 0 ? techs.map((tech) => (
              <tr key={tech.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{tech.first_name} {tech.last_name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{tech.email ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{tech.phone ?? '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{tech.specialization ?? '-'}</td>
                <td className="px-4 py-3 text-end text-sm text-gray-700">{tech.hourly_rate ? Number(tech.hourly_rate).toFixed(2) : '-'}</td>
                <td className="px-4 py-3 text-end">
                  <button onClick={() => startEdit(tech)} className="text-xs text-primary-600 hover:text-primary-700 me-3">Edit</button>
                  <button onClick={() => { if (confirm('Delete this technician?')) deleteMutation.mutate(tech.id); }} className="text-xs text-red-500 hover:text-red-700">Delete</button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">No technicians yet.</td>
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name *</label>
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Specialization</label>
                  <input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. Engine, Electrical" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Hourly Rate</label>
                  <input type="number" step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
              </div>
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
