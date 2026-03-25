'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDebounce } from '@/hooks/use-debounce';
import { useVendors, useCreateVendor } from '@/hooks/use-purchases';
import { api } from '@/lib/api';

export default function VendorsPage() {
  const t = useTranslations('purchases');
  const tc = useTranslations('common');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [showModal, setShowModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useVendors(debouncedSearch || undefined);
  const createMutation = useCreateVendor();

  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    leadTimeDays: '',
    paymentTerms: '',
    notes: '',
  });

  const handleSave = async () => {
    try {
      setFormError(null);
      const payload = {
        name: form.name,
        contactName: form.contactName || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        address: form.address || undefined,
        taxId: form.taxId || undefined,
        leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
        paymentTerms: form.paymentTerms || undefined,
        notes: form.notes || undefined,
      };

      if (editingId) {
        await api.patch(`/vendors/${editingId}`, payload);
      } else {
        await createMutation.mutateAsync(payload);
      }

      setShowModal(false);
      setEditingId(null);
      setForm({ name: '', contactName: '', phone: '', email: '', address: '', taxId: '', leadTimeDays: '', paymentTerms: '', notes: '' });
      setSuccessMsg(editingId ? t('updatedSuccess') : t('createdSuccess'));
      setTimeout(() => setSuccessMsg(null), 3000);
      window.location.reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create vendor');
    }
  };

  const vendors = Array.isArray(data) ? data : (data?.data ?? []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('vendorsTitle')}</h1>
        <button
          onClick={() => { setEditingId(null); setForm({ name: '', contactName: '', phone: '', email: '', address: '', taxId: '', leadTimeDays: '', paymentTerms: '', notes: '' }); setShowModal(true); }}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('newVendor')}
        </button>
      </div>

      {successMsg && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      <div className="mb-4">
        <input
          type="text"
          placeholder={t('searchVendorPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500">{tc('loading')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('name')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('contactPerson')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('phone')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('email')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('leadTime')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('paymentTerms')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {vendors.length > 0 ? (
                vendors.map((vendor) => (
                  <>
                    <tr
                      key={vendor.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setExpandedId(expandedId === vendor.id ? null : vendor.id)}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-primary-600">{vendor.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{vendor.contact_name ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{vendor.phone ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{vendor.email ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {vendor.lead_time_days ? `${vendor.lead_time_days} ${t('days')}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{vendor.payment_terms ?? '-'}</td>
                    </tr>
                    {expandedId === vendor.id && (
                      <tr key={`${vendor.id}-detail`}>
                        <td colSpan={6} className="border-b border-gray-200 bg-gray-50 px-6 py-4">
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="font-medium text-gray-500">{tc('address')}</p>
                                <p className="mt-0.5 text-gray-900">{vendor.address || '-'}</p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-500">NIF</p>
                                <p className="mt-0.5 text-gray-900">{vendor.tax_id || '-'}</p>
                              </div>
                            </div>
                            <div className="text-sm">
                              <p className="font-medium text-gray-500">{tc('notes')}</p>
                              <p className="mt-0.5 text-gray-900">{vendor.notes || '-'}</p>
                            </div>
                            <div className="flex justify-end border-t border-gray-200 pt-3">
                              <button
                                onClick={() => {
                                  setForm({
                                    name: vendor.name || '',
                                    contactName: vendor.contact_name || '',
                                    phone: vendor.phone || '',
                                    email: vendor.email || '',
                                    address: vendor.address || '',
                                    taxId: vendor.tax_id || '',
                                    leadTimeDays: vendor.lead_time_days?.toString() || '',
                                    paymentTerms: vendor.payment_terms || '',
                                    notes: vendor.notes || '',
                                  });
                                  setEditingId(vendor.id);
                                  setShowModal(true);
                                }}
                                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                              >
                                {tc('edit')}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    {t('noVendors')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingId ? tc('edit') : t('newVendor')}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('name')}</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('contactPerson')}</label>
                  <input
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tc('phone')}</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tc('email')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">NIF</label>
                  <input
                    value={form.taxId}
                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('address')}</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('leadTime')}</label>
                  <input
                    type="number"
                    value={form.leadTimeDays}
                    onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                    placeholder={t('days')}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('paymentTerms')}</label>
                  <select
                    value={form.paymentTerms}
                    onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="">-</option>
                    <option value="Immediate">Immediate</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Net 90">Net 90</option>
                    <option value="COD">COD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex items-center justify-between">
                {/* Delete — only when editing, placed left for safety */}
                {editingId ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t('confirmDeleteVendor'))) {
                        api.patch(`/vendors/${editingId}`, { isActive: false })
                          .then(() => {
                            setShowModal(false);
                            setEditingId(null);
                            setSuccessMsg(t('deletedSuccess'));
                            setTimeout(() => setSuccessMsg(null), 3000);
                            setExpandedId(null);
                            window.location.reload();
                          })
                          .catch(() => setFormError('Failed to delete vendor'));
                      }
                    }}
                    className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                  >
                    {tc('delete')}
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="rounded-md border px-4 py-2 text-sm">
                    {tc('cancel')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={createMutation.isPending}
                    className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {createMutation.isPending ? tc('loading') : tc('save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
