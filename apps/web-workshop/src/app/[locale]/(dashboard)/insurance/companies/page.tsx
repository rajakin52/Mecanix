'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useInsuranceCompanies, useCreateInsuranceCompany, useUpdateInsuranceCompany } from '@/hooks/use-insurance';
import { Link } from '@/i18n/navigation';

interface CompanyRow {
  id: string;
  name: string;
  code: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  submission_email: string | null;
  sla_hours: number | null;
  materials_rate_refinish: number | string | null;
  materials_rate_body: number | string | null;
  shop_supplies_pct: number | string | null;
  shop_supplies_cap: number | string | null;
}

const EMPTY_FORM = {
  name: '',
  code: '',
  contactPerson: '',
  phone: '',
  email: '',
  submissionEmail: '',
  slaHours: '',
  materialsRateRefinish: '',
  materialsRateBody: '',
  shopSuppliesPct: '',
  shopSuppliesCap: '',
};

export default function InsuranceCompaniesPage() {
  const t = useTranslations('insurance');
  const tc = useTranslations('common');

  const { data, isLoading } = useInsuranceCompanies();
  const createMutation = useCreateInsuranceCompany();
  const updateMutation = useUpdateInsuranceCompany();

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const update = (patch: Partial<typeof EMPTY_FORM>) => setForm((f) => ({ ...f, ...patch }));

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setShowModal(true);
  };

  const openEdit = (co: CompanyRow) => {
    setEditId(co.id);
    setForm({
      name: co.name ?? '',
      code: co.code ?? '',
      contactPerson: co.contact_person ?? '',
      phone: co.phone ?? '',
      email: co.email ?? '',
      submissionEmail: co.submission_email ?? '',
      slaHours: co.sla_hours != null ? String(co.sla_hours) : '',
      materialsRateRefinish: co.materials_rate_refinish != null ? String(co.materials_rate_refinish) : '',
      materialsRateBody: co.materials_rate_body != null ? String(co.materials_rate_body) : '',
      // pct stored as 0..1 in DB; show as percentage in the form
      shopSuppliesPct: co.shop_supplies_pct != null ? String(Number(co.shop_supplies_pct) * 100) : '',
      shopSuppliesCap: co.shop_supplies_cap != null ? String(co.shop_supplies_cap) : '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    const payload = {
      name: form.name,
      code: form.code || undefined,
      contactName: form.contactPerson || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      submissionEmail: form.submissionEmail || undefined,
      slaHours: form.slaHours ? Number(form.slaHours) : undefined,
      materialsRateRefinish: form.materialsRateRefinish === '' ? null : Number(form.materialsRateRefinish),
      materialsRateBody: form.materialsRateBody === '' ? null : Number(form.materialsRateBody),
      shopSuppliesPct: form.shopSuppliesPct === '' ? null : Number(form.shopSuppliesPct) / 100,
      shopSuppliesCap: form.shopSuppliesCap === '' ? null : Number(form.shopSuppliesCap),
    };
    if (editId) {
      await updateMutation.mutateAsync({ id: editId, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setShowModal(false);
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setSuccessMsg('Saved successfully!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const companies = ((data ?? []) as unknown as CompanyRow[]);
  const fmtRate = (v: number | string | null | undefined) =>
    v == null || v === '' ? '—' : Number(v).toFixed(2);
  const fmtPct = (v: number | string | null | undefined) =>
    v == null || v === '' ? '—' : `${(Number(v) * 100).toFixed(1)}%`;

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="mb-4">
        <Link href="/insurance" className="text-sm text-primary-600 hover:underline">
          &larr; {tc('back')}
        </Link>
      </div>

      {successMsg && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('companies')}</h1>
        <button
          onClick={openCreate}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('addCompany')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-gray-500">{tc('loading')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('companyName')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Code</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('phone')}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">SLA</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500" title="Refinish materials rate">Refinish</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500" title="Body materials rate">Body</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500" title="Shop supplies as % of mechanical labour">Supplies %</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {companies.length > 0 ? (
                companies.map((co) => (
                  <tr key={co.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{co.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{co.code ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{co.phone ?? '—'}</td>
                    <td className="px-4 py-3 text-end text-sm text-gray-700">{co.sla_hours != null ? `${co.sla_hours}h` : '—'}</td>
                    <td className="px-4 py-3 text-end text-sm text-gray-700">{fmtRate(co.materials_rate_refinish)}</td>
                    <td className="px-4 py-3 text-end text-sm text-gray-700">{fmtRate(co.materials_rate_body)}</td>
                    <td className="px-4 py-3 text-end text-sm text-gray-700">{fmtPct(co.shop_supplies_pct)}</td>
                    <td className="px-4 py-3 text-end text-sm">
                      <button
                        onClick={() => openEdit(co)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        {tc('edit')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    {tc('noResults')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editId ? `Edit — ${form.name}` : t('addCompany')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label={t('companyName')} required>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => update({ name: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </Field>
                <Field label="Code">
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => update({ code: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </Field>
              </div>
              <Field label="Contact">
                <input
                  type="text"
                  value={form.contactPerson}
                  onChange={(e) => update({ contactPerson: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label={tc('phone')}>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => update({ phone: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </Field>
                <Field label={tc('email')}>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update({ email: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </Field>
              </div>
              <Field label="Submission email" hint="for claim packets">
                <input
                  type="email"
                  value={form.submissionEmail}
                  onChange={(e) => update({ submissionEmail: e.target.value })}
                  placeholder="claims@insurer.com"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </Field>
              <Field label={t('slaHours')}>
                <input
                  type="number"
                  min="0"
                  value={form.slaHours}
                  onChange={(e) => update({ slaHours: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </Field>

              <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3">
                <div className="mb-2 text-sm font-semibold text-gray-700">Materials rate overrides</div>
                <p className="mb-3 text-xs text-gray-500">
                  Optional. When set, these override the tenant defaults for jobs linked to this insurance company. Leave empty to inherit tenant defaults.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Refinish rate (per refinish hour)">
                    <input
                      type="number"
                      step="0.01"
                      value={form.materialsRateRefinish}
                      onChange={(e) => update({ materialsRateRefinish: e.target.value })}
                      placeholder="inherit"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Body rate (per body hour)">
                    <input
                      type="number"
                      step="0.01"
                      value={form.materialsRateBody}
                      onChange={(e) => update({ materialsRateBody: e.target.value })}
                      placeholder="inherit"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Shop supplies (% of mech labour)">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={form.shopSuppliesPct}
                      onChange={(e) => update({ shopSuppliesPct: e.target.value })}
                      placeholder="inherit"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </Field>
                  <Field label="Shop supplies cap">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.shopSuppliesCap}
                      onChange={(e) => update({ shopSuppliesCap: e.target.value })}
                      placeholder="inherit"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </Field>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? tc('loading') : (editId ? tc('save') : tc('create'))}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ms-0.5 text-red-500">*</span>}
        {hint && <span className="ms-1 text-xs font-normal text-gray-400">({hint})</span>}
      </label>
      {children}
    </div>
  );
}
