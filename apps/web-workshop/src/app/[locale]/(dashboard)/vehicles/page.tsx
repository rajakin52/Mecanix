'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useDebounce } from '@/hooks/use-debounce';
import { useVehicles, useCreateVehicle } from '@/hooks/use-vehicles';
import { useCustomers } from '@/hooks/use-customers';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createVehicleSchema } from '@mecanix/validators';
import type { CreateVehicleInput } from '@mecanix/validators';
import { Link } from '@/i18n/navigation';
import { api } from '@/lib/api';

export default function VehiclesPage() {
  const t = useTranslations('vehicles');
  const tc = useTranslations('common');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useVehicles(page, debouncedSearch);
  const createMutation = useCreateVehicle();
  const { data: customersData } = useCustomers(1, '');
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [vinLoading, setVinLoading] = useState(false);
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<CreateVehicleInput>({
    resolver: zodResolver(createVehicleSchema),
  });

  const handleVinChange = useCallback(async (vin: string) => {
    if (vin.length !== 17) return;
    setVinLoading(true);
    try {
      const info = await api.get<{ make: string; model: string; year: number | null; engineSize: string | null; fuelType: string | null }>(`/vehicles/vin/${vin}`);
      if (info) {
        if (info.make && info.make !== 'Unknown') setValue('make', info.make);
        if (info.model && info.model !== 'Unknown') setValue('model', info.model);
        if (info.year) setValue('year', info.year);
        if (info.fuelType) {
          const fuelMap: Record<string, string> = { gasoline: 'petrol', diesel: 'diesel', electric: 'electric', hybrid: 'hybrid' };
          const mapped = fuelMap[info.fuelType] ?? info.fuelType;
          if (['petrol', 'diesel', 'electric', 'hybrid', 'lpg'].includes(mapped)) {
            setValue('fuelType', mapped as 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'lpg');
          }
        }
        if (info.engineSize) setValue('engineSize', info.engineSize);
      }
    } catch {
      // VIN decode failed silently — user can fill in manually
    } finally {
      setVinLoading(false);
    }
  }, [setValue]);

  const onSubmit = async (formData: CreateVehicleInput) => {
    try {
      setFormError(null);
      await createMutation.mutateAsync(formData as Parameters<typeof createMutation.mutateAsync>[0]);
      setShowModal(false);
      reset();
      setSuccessMsg('Saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create vehicle');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('newVehicle')}
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
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('plate')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('make')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('model')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('year')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('customer')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((vehicle: Record<string, unknown>) => (
                    <tr key={vehicle.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono font-medium">
                        <Link href={`/vehicles/${vehicle.id as string}`} className="text-primary-600 hover:text-primary-700 hover:underline">
                          {vehicle.plate as string}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.make as string}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.model as string}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{(vehicle.year as number) ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {(vehicle.customers as Record<string, string> | null)?.full_name ?? '-'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                      {t('noVehicles')}
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
              <span className="text-sm text-gray-600">{page} / {data.meta.totalPages}</span>
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

      {/* New Vehicle Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('newVehicle')}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('customer')}</label>
                <select {...register('customerId')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
                  <option value="">{tc('select')}...</option>
                  {(customersData?.data as Array<Record<string, unknown>> | undefined)?.map((c) => (
                    <option key={c.id as string} value={c.id as string}>
                      {c.full_name as string}
                    </option>
                  ))}
                </select>
                {errors.customerId && <p className="mt-1 text-sm text-red-600">{errors.customerId.message}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('plate')}</label>
                  <input {...register('plate')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  {errors.plate && <p className="mt-1 text-sm text-red-600">{errors.plate.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('vin')}</label>
                  <div className="relative">
                    <input
                      {...register('vin', {
                        onChange: (e) => handleVinChange(e.target.value),
                      })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                      maxLength={17}
                      placeholder="17 characters"
                    />
                    {vinLoading && (
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-primary-600">
                        {tc('loading')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('make')}</label>
                  <input {...register('make')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  {errors.make && <p className="mt-1 text-sm text-red-600">{errors.make.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('model')}</label>
                  <input {...register('model')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  {errors.model && <p className="mt-1 text-sm text-red-600">{errors.model.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('year')}</label>
                  <input {...register('year', { valueAsNumber: true })} type="number" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('color')}</label>
                  <input {...register('color')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('mileage')}</label>
                  <input {...register('mileage', { valueAsNumber: true })} type="number" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('fuelType')}</label>
                <select {...register('fuelType')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
                  <option value="">-</option>
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="lpg">LPG</option>
                </select>
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
