'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCustomers, useCreateCustomer, useDeleteCustomer } from '@/hooks/use-customers';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCustomerSchema } from '@mecanix/validators';
import type { CreateCustomerInput } from '@mecanix/validators';
import { Link } from '@/i18n/navigation';

export default function CustomersPage() {
  const t = useTranslations('customers');
  const tc = useTranslations('common');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useCustomers(page, search);
  const createMutation = useCreateCustomer();
  const deleteMutation = useDeleteCustomer();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
  });

  const onSubmit = async (formData: CreateCustomerInput) => {
    await createMutation.mutateAsync(formData);
    setShowModal(false);
    reset();
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
        <p className="text-gray-500">{tc('loading')}</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('fullName')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('phone')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('email')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((customer: Record<string, unknown>) => (
                    <tr key={customer.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/customers/${customer.id as string}`}>
                          {customer.full_name as string}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{customer.phone as string}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{(customer.email as string) ?? '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => deleteMutation.mutate(customer.id as string)}
                          className="text-red-600 hover:text-red-800"
                        >
                          {tc('delete')}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      {t('noCustomers')}
                    </td>
                  </tr>
                )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('newCustomer')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('fullName')}</label>
                <input {...register('fullName')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('phone')}</label>
                <input {...register('phone')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('email')}</label>
                <input {...register('email')} type="email" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('taxId')}</label>
                <input {...register('taxId')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('address')}</label>
                <input {...register('address')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('notes')}</label>
                <textarea {...register('notes')} rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? tc('loading') : tc('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
