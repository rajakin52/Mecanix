'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCustomer, useUpdateCustomer } from '@/hooks/use-customers';
import { useVehicles } from '@/hooks/use-vehicles';
import { Link } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateCustomerSchema } from '@mecanix/validators';
import type { UpdateCustomerInput } from '@mecanix/validators';

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const tc = useTranslations('customers');
  const tv = useTranslations('vehicles');
  const t = useTranslations('common');

  const [showEditModal, setShowEditModal] = useState(false);

  const { data: customer, isLoading, isError } = useCustomer(id);
  const { data: vehiclesData, isLoading: vehiclesLoading } = useVehicles(1, '', id);
  const updateMutation = useUpdateCustomer();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateCustomerInput>({
    resolver: zodResolver(updateCustomerSchema),
  });

  useEffect(() => {
    if (customer) {
      reset({
        fullName: (customer as Record<string, unknown>).full_name as string ?? '',
        phone: (customer as Record<string, unknown>).phone as string ?? '',
        email: (customer as Record<string, unknown>).email as string ?? '',
        taxId: (customer as Record<string, unknown>).tax_id as string ?? '',
        address: (customer as Record<string, unknown>).address as string ?? '',
        notes: (customer as Record<string, unknown>).notes as string ?? '',
      });
    }
  }, [customer, reset]);

  const onSubmit = async (formData: UpdateCustomerInput) => {
    await updateMutation.mutateAsync({ id, ...formData });
    setShowEditModal(false);
  };

  if (isLoading) {
    return <p className="text-gray-500">{t('loading')}</p>;
  }

  if (isError || !customer) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{t('error')}</p>
        <Link href="/customers" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
          {t('back')}
        </Link>
      </div>
    );
  }

  const c = customer as Record<string, unknown>;

  return (
    <div>
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/customers"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; {t('back')}
        </Link>
      </div>

      {/* Customer Profile Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{c.full_name as string}</h1>
          <button
            onClick={() => setShowEditModal(true)}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {t('edit')}
          </button>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('phone')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{(c.phone as string) || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('email')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{(c.email as string) || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('taxId')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{(c.tax_id as string) || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('address')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{(c.address as string) || '-'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">{tc('notes')}</dt>
            <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{(c.notes as string) || '-'}</dd>
          </div>
        </dl>
      </div>

      {/* Linked Vehicles */}
      <div className="mt-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">{tv('linkedVehicles')}</h2>

        {vehiclesLoading ? (
          <p className="text-gray-500">{t('loading')}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tv('plate')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tv('make')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tv('model')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tv('year')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {vehiclesData?.data && vehiclesData.data.length > 0 ? (
                  vehiclesData.data.map((vehicle: Record<string, unknown>) => (
                    <tr key={vehicle.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/vehicles/${vehicle.id as string}`}>
                          {vehicle.plate as string}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.make as string}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.model as string}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.year as number}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      {tv('noVehicles')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Customer Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{tc('editCustomer')}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">&#10005;</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('fullName')}</label>
                <input {...register('fullName')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('phone')}</label>
                <input {...register('phone')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('email')}</label>
                <input {...register('email')} type="email" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('taxId')}</label>
                <input {...register('taxId')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('address')}</label>
                <input {...register('address')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea {...register('notes')} rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? t('loading') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
