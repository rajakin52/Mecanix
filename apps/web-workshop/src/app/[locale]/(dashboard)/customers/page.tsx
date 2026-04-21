'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDebounce } from '@/hooks/use-debounce';
import { useCustomers, useCreateCustomer, useDeleteCustomer } from '@/hooks/use-customers';
import { useCustomerDuplicates } from '@/hooks/use-duplicates';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCustomerSchema } from '@mecanix/validators';
import type { CreateCustomerInput } from '@mecanix/validators';
import type { CreateCustomerDto } from '@mecanix/types';
import { Link } from '@/i18n/navigation';
import { Building2 } from 'lucide-react';
import { usePriceGroups } from '@/hooks/use-pricing';
import { SkeletonTable, useToast, EmptyState, SortableHeader, sortData, type SortDirection } from '@mecanix/ui-web';

const PAYMENT_TERMS_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'Immediate', label: 'Immediate' },
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 45', label: 'Net 45' },
  { value: 'Net 60', label: 'Net 60' },
  { value: 'Net 90', label: 'Net 90' },
  { value: 'COD', label: 'COD' },
];

export default function CustomersPage() {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const toast = useToast();

  const { data, isLoading } = useCustomers(page, debouncedSearch);
  const createMutation = useCreateCustomer();
  const deleteMutation = useDeleteCustomer();
  const { data: priceGroups } = usePriceGroups();
  const pgList = Array.isArray(priceGroups) ? priceGroups : [];

  const handleSort = (field: string, dir: SortDirection) => {
    setSortField(dir ? field : null);
    setSortDir(dir);
  };

  const [isCorporate, setIsCorporate] = useState(false);

  const { register, handleSubmit, reset, formState: { errors }, setValue, watch } = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
  });

  const watchedPhone = watch('phone');
  const watchedEmail = watch('email');
  const watchedName = watch('fullName');
  const { data: duplicates } = useCustomerDuplicates({
    phone: watchedPhone,
    email: watchedEmail,
    fullName: watchedName,
  });

  const onSubmit = async (formData: CreateCustomerInput) => {
    await createMutation.mutateAsync(formData as unknown as CreateCustomerDto);
    setShowModal(false);
    reset();
    setIsCorporate(false);
    toast.success(t('createdSuccess'));
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteMutation.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
    toast.success(t('deletedSuccess'));
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('newCustomer')}
        </button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={4} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader label={t('fullName')} field="full_name" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <SortableHeader label={t('phone')} field="phone" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <SortableHeader label={t('email')} field="email" currentSort={sortField} currentDirection={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {(() => {
                  const customers = data?.data ?? [];
                  const sortedCustomers = sortData(customers as unknown as Record<string, unknown>[], sortField, sortDir) as unknown as typeof customers;
                  return sortedCustomers.length > 0 ? (
                  sortedCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/customers/${customer.id}`} className="inline-flex items-center gap-1.5">
                          {customer.full_name}
                          {customer.is_corporate && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                              <Building2 className="h-3 w-3" />
                              {t('corporate')}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{customer.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{customer.email ?? '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => setDeleteConfirm({ id: customer.id, name: customer.full_name })}
                          className="text-red-600 hover:text-red-800"
                        >
                          {tc('delete')}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>
                      <EmptyState icon="customers" title="No customers yet" description="Add your first customer to begin" action={{ label: t('newCustomer'), onClick: () => setShowModal(true) }} />
                    </td>
                  </tr>
                );
                })()}
              </tbody>
            </table>
          </div>

          {data?.meta && data.meta.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                {tc('previous')}
              </button>
              <span className="text-sm text-gray-600">
                {page} / {data.meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= data.meta.totalPages}
                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
              >
                {tc('next')}
              </button>
            </div>
          )}
        </>
      )}

      {/* New Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{t('newCustomer')}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100">&#10005;</button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <form id="create-customer-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* Duplicate warning */}
                {duplicates && duplicates.length > 0 ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                    <div className="text-xs font-semibold text-amber-900">
                      Possible duplicate{duplicates.length === 1 ? '' : 's'} found
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-amber-800">
                      {duplicates.slice(0, 5).map((d) => (
                        <li key={d.id}>
                          <span className="font-medium">{d.full_name}</span>
                          {d.phone ? <span className="ms-2 text-amber-700">{d.phone}</span> : null}
                          {d.email ? <span className="ms-2 text-amber-700">{d.email}</span> : null}
                          <span className="ms-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                            matched by {d.match_reason}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-amber-700">
                      Use an existing record if this is the same person — avoids split history.
                    </p>
                  </div>
                ) : null}

                {/* ── Contact Information ── */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">{t('fullName')} *</label>
                      <input {...register('fullName')} placeholder="Full name"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                      {errors.fullName && <p className="mt-1 text-xs text-red-600">{errors.fullName.message}</p>}
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-sm font-medium text-gray-700">{t('phone')} *</label>
                      <input {...register('phone')} placeholder="+244 923 456 789"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                      {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
                      <input {...register('whatsappNumber')} placeholder="If different from phone"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('email')}</label>
                      <input {...register('email')} type="email" placeholder="email@example.com"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700">Street Address</label>
                      <input {...register('addressStreet')} placeholder="Street name, building, apartment"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">City</label>
                      <input {...register('addressCity')} placeholder="City"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">State / Province</label>
                      <input {...register('addressState')} placeholder="State or province"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Postal Code</label>
                      <input {...register('addressPostal')} placeholder="Postal / ZIP code"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Country</label>
                      <input {...register('addressCountry')} placeholder="Country"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Preferred Contact</label>
                      <select {...register('preferredChannel')} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200">
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                        <option value="email">Email</option>
                        <option value="app">App</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('taxId')}</label>
                      <input {...register('taxId')} placeholder="NIF / Tax ID"
                        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                    </div>
                  </div>
                </div>

                {/* ── Financial ── */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Financial</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">{t('paymentTerms')}</label>
                      <select {...register('paymentTerms')} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200">
                        {PAYMENT_TERMS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Price Group</label>
                      <select {...register('priceGroupId')} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200">
                        <option value="">Default pricing</option>
                        {pgList.map((pg) => (
                          <option key={pg.id} value={pg.id}>{pg.name} ({pg.default_markup_pct}%)</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Corporate Account ── */}
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isCorporate"
                        checked={isCorporate}
                        onChange={(e) => {
                          setIsCorporate(e.target.checked);
                          setValue('isCorporate', e.target.checked);
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <label htmlFor="isCorporate" className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('corporateAccount')}</label>
                    </div>
                  </div>

                  {isCorporate && (
                    <div className="rounded-lg border border-primary-200 bg-primary-50/50 p-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-sm font-medium text-gray-700">{t('companyName')} *</label>
                          <input {...register('companyName')} placeholder="Company legal name"
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <label className="block text-sm font-medium text-gray-700">{t('billingContact')}</label>
                          <input {...register('billingContact')} placeholder="Billing department contact"
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">{t('creditLimit')}</label>
                          <input {...register('creditLimit')} type="number" min="0" step="0.01" placeholder="0.00"
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Credit Terms (days)</label>
                          <input {...register('creditTermsDays')} type="number" min="0" max="365" placeholder="30"
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Tax treatment (Angola) ── */}
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <p className="mb-3 text-sm font-semibold text-gray-800">Tax treatment</p>

                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700">IVA Cativo</label>
                    <select
                      {...register('vatCaptivePct', { valueAsNumber: true })}
                      defaultValue={0}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 bg-white focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                    >
                      <option value={0}>0% — Cliente normal</option>
                      <option value={50}>50% — Banco / Seguradora / Telecom</option>
                      <option value={100}>100% — Entidade pública / Empresa petrolífera</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      % do IVA que o cliente retém directamente à AGT.
                    </p>
                  </div>

                  <label className="flex items-start gap-2 text-sm">
                    <input
                      {...register('withholdsServiceRetention')}
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600"
                    />
                    <span>
                      <span className="font-medium text-gray-800">Retém 6.5% sobre serviços</span>
                      <span className="block text-xs text-gray-500">
                        Aplicável quando o cliente é uma entidade que retém o imposto industrial sobre a prestação de serviços. Apenas afecta a parte de mão-de-obra da factura.
                      </span>
                    </span>
                  </label>
                </div>

                {/* ── Notes ── */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('notes')}</label>
                  <textarea {...register('notes')} rows={2} placeholder="Internal notes about this customer..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200" />
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
                {tc('cancel')}
              </button>
              <button
                type="submit"
                form="create-customer-form"
                disabled={createMutation.isPending}
                className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 shadow-sm"
              >
                {createMutation.isPending ? tc('loading') : tc('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{tc('confirmDelete')}</h2>
            <p className="text-sm text-gray-600 mb-6">
              {t('confirmDelete')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                {tc('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? tc('loading') : tc('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
