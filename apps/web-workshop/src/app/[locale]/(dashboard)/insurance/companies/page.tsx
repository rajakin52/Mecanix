'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useInsuranceCompanies, useCreateInsuranceCompany } from '@/hooks/use-insurance';
import { Link } from '@/i18n/navigation';

export default function InsuranceCompaniesPage() {
  const t = useTranslations('insurance');
  const tc = useTranslations('common');

  const { data, isLoading } = useInsuranceCompanies();
  const createMutation = useCreateInsuranceCompany();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [slaHours, setSlaHours] = useState('');

  const handleCreate = async () => {
    if (!name) return;
    await createMutation.mutateAsync({
      name,
      code: code || undefined,
      contact_person: contactPerson || undefined,
      phone: phone || undefined,
      email: email || undefined,
      sla_hours: slaHours ? Number(slaHours) : undefined,
    });
    setShowModal(false);
    setName('');
    setCode('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setSlaHours('');
  };

  const companies = (data as Array<Record<string, unknown>> | undefined) ?? [];

  return (
    <div>
      {/* Back link */}
      <div className="mb-4">
        <Link href="/insurance" className="text-sm text-primary-600 hover:underline">
          &larr; {tc('back')}
        </Link>
      </div>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('companies')}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('addCompany')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">{tc('loading')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('companyName')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Code</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Contact</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('phone')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('email')}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('slaHours')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {companies.length > 0 ? (
                companies.map((co) => (
                  <tr key={co.id as string} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{co.name as string}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{(co.code as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{(co.contact_person as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{(co.phone as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{(co.email as string) ?? '-'}</td>
                    <td className="px-4 py-3 text-end text-sm text-gray-700">{co.sla_hours != null ? `${co.sla_hours}h` : '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    {tc('noResults')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Company Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('addCompany')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('companyName')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contact</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tc('phone')}</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tc('email')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('slaHours')}</label>
                <input
                  type="number"
                  min="0"
                  value={slaHours}
                  onChange={(e) => setSlaHours(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !name}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? tc('loading') : tc('create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
