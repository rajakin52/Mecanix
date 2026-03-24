'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useVehicle, useUpdateVehicle } from '@/hooks/use-vehicles';
import { useVehicleReminders, useCreateReminder, useCompleteReminder, useMarkReminderSent } from '@/hooks/use-reminders';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateVehicleSchema } from '@mecanix/validators';
import type { UpdateVehicleInput } from '@mecanix/validators';
import { Link } from '@/i18n/navigation';

export default function VehicleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const tv = useTranslations('vehicles');
  const t = useTranslations('common');
  const tr = useTranslations('reminders');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [reminderType, setReminderType] = useState<'date' | 'mileage' | 'both'>('date');
  const [reminderForm, setReminderForm] = useState({
    serviceName: '',
    nextDate: '',
    dateIntervalDays: '',
    nextMileage: '',
    mileageInterval: '',
    notes: '',
  });

  const { data: vehicle, isLoading, error } = useVehicle(id);
  const updateMutation = useUpdateVehicle();
  const { data: reminders, isLoading: loadingReminders } = useVehicleReminders(id);
  const createReminder = useCreateReminder();
  const completeReminder = useCompleteReminder();
  const markSent = useMarkReminderSent();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<UpdateVehicleInput>({
    resolver: zodResolver(updateVehicleSchema),
  });

  useEffect(() => {
    if (vehicle) {
      reset({
        plate: (vehicle as Record<string, unknown>).plate as string,
        make: (vehicle as Record<string, unknown>).make as string,
        model: (vehicle as Record<string, unknown>).model as string,
        year: (vehicle as Record<string, unknown>).year as number | undefined,
        color: (vehicle as Record<string, unknown>).color as string | undefined,
        vin: (vehicle as Record<string, unknown>).vin as string | undefined,
        fuelType: (vehicle as Record<string, unknown>).fuel_type as 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'lpg' | undefined,
        engineSize: (vehicle as Record<string, unknown>).engine_size as string | undefined,
        mileage: (vehicle as Record<string, unknown>).mileage as number | undefined,
        notes: (vehicle as Record<string, unknown>).notes as string | undefined,
      });
    }
  }, [vehicle, reset]);

  const onSubmit = async (formData: UpdateVehicleInput) => {
    await updateMutation.mutateAsync({ id, ...formData });
    setShowEditModal(false);
  };

  const handleCreateReminder = async () => {
    const v2 = vehicle as Record<string, unknown>;
    await createReminder.mutateAsync({
      vehicleId: id,
      customerId: v2.customer_id as string,
      reminderType: reminderType,
      serviceName: reminderForm.serviceName,
      ...(reminderType !== 'mileage' && reminderForm.nextDate ? { nextDate: reminderForm.nextDate } : {}),
      ...(reminderType !== 'mileage' && reminderForm.dateIntervalDays ? { dateIntervalDays: Number(reminderForm.dateIntervalDays) } : {}),
      ...(reminderType !== 'date' && reminderForm.nextMileage ? { nextMileage: Number(reminderForm.nextMileage) } : {}),
      ...(reminderType !== 'date' && reminderForm.mileageInterval ? { mileageInterval: Number(reminderForm.mileageInterval) } : {}),
      ...(reminderForm.notes ? { notes: reminderForm.notes } : {}),
    });
    setShowReminderForm(false);
    setReminderForm({ serviceName: '', nextDate: '', dateIntervalDays: '', nextMileage: '', mileageInterval: '', notes: '' });
    setReminderType('date');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">{t('loading')}</p>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="py-12 text-center">
        <p className="text-red-600">{t('error')}</p>
        <Link href="/vehicles" className="mt-4 inline-block text-sm text-primary-600 hover:text-primary-700">
          &larr; {tv('backToVehicles')}
        </Link>
      </div>
    );
  }

  const v = vehicle as Record<string, unknown>;
  const customer = v.customers as Record<string, string> | null;
  const photos = v.photos as string[] | null;

  return (
    <div>
      {/* Back button */}
      <div className="mb-6">
        <Link href="/vehicles" className="text-sm text-primary-600 hover:text-primary-700">
          &larr; {tv('backToVehicles')}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 font-mono">{v.plate as string}</h1>
          <p className="mt-1 text-gray-500">
            {[v.make, v.model, v.year].filter(Boolean).join(' ')}
          </p>
        </div>
        <button
          onClick={() => setShowEditModal(true)}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('edit')}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Vehicle Info Card */}
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{tv('vehicleInfo')}</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('plate')}</dt>
              <dd className="mt-1 text-sm font-mono font-medium text-gray-900">{v.plate as string}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('vin')}</dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">{(v.vin as string) || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('make')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{v.make as string}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('model')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{v.model as string}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('year')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{(v.year as number) ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('color')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{(v.color as string) || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('fuelType')}</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">{(v.fuel_type as string) || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('engineSize')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{(v.engine_size as string) || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('mileage')}</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {(v.mileage as number) != null ? `${(v.mileage as number).toLocaleString()} km` : '-'}
              </dd>
            </div>
          </dl>
          {(v.notes as string) && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('notes')}</dt>
              <dd className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{v.notes as string}</dd>
            </div>
          )}
        </div>

        {/* Owner Info Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{tv('owner')}</h2>
          {customer ? (
            <div>
              <Link
                href={`/customers/${v.customer_id as string}`}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 hover:underline"
              >
                {customer.full_name}
              </Link>
              {customer.phone && (
                <p className="mt-1 text-sm text-gray-600">{customer.phone}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">-</p>
          )}
        </div>
      </div>

      {/* Photo Gallery */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{tv('photos')}</h2>
        {photos && photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((url, index) => (
              <div key={index} className="aspect-square overflow-hidden rounded-md border border-gray-200">
                <img
                  src={url}
                  alt={`${v.plate as string} photo ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">{tv('noPhotos')}</p>
        )}
      </div>

      {/* Service History */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{tv('serviceHistory')}</h2>
        <p className="py-8 text-center text-sm text-gray-500">{tv('noServiceHistory')}</p>
      </div>

      {/* Service Reminders */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{tr('title')}</h2>
          <button
            onClick={() => setShowReminderForm(!showReminderForm)}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {tr('addReminder')}
          </button>
        </div>

        {/* Inline Add Reminder Form */}
        {showReminderForm && (
          <div className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">{tr('serviceName')}</label>
                <select
                  value={reminderForm.serviceName}
                  onChange={(e) => setReminderForm({ ...reminderForm, serviceName: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">{tr('selectService')}</option>
                  <option value="Oil Change">{tr('serviceOilChange')}</option>
                  <option value="Brake Pads">{tr('serviceBrakePads')}</option>
                  <option value="Timing Belt">{tr('serviceTimingBelt')}</option>
                  <option value="Tire Rotation">{tr('serviceTireRotation')}</option>
                  <option value="Air Filter">{tr('serviceAirFilter')}</option>
                  <option value="General Service">{tr('serviceGeneral')}</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">{tr('reminderType')}</label>
                <div className="mt-1 flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      checked={reminderType === 'date'}
                      onChange={() => setReminderType('date')}
                    />
                    {tr('dateBased')}
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      checked={reminderType === 'mileage'}
                      onChange={() => setReminderType('mileage')}
                    />
                    {tr('mileageBased')}
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      checked={reminderType === 'both'}
                      onChange={() => setReminderType('both')}
                    />
                    {tr('both')}
                  </label>
                </div>
              </div>

              {(reminderType === 'date' || reminderType === 'both') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{tr('nextDate')}</label>
                    <input
                      type="date"
                      value={reminderForm.nextDate}
                      onChange={(e) => setReminderForm({ ...reminderForm, nextDate: e.target.value })}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{tr('intervalDays')}</label>
                    <input
                      type="number"
                      value={reminderForm.dateIntervalDays}
                      onChange={(e) => setReminderForm({ ...reminderForm, dateIntervalDays: e.target.value })}
                      placeholder="180"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                </>
              )}

              {(reminderType === 'mileage' || reminderType === 'both') && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{tr('nextMileage')}</label>
                    <input
                      type="number"
                      value={reminderForm.nextMileage}
                      onChange={(e) => setReminderForm({ ...reminderForm, nextMileage: e.target.value })}
                      placeholder="50000"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{tr('intervalKm')}</label>
                    <input
                      type="number"
                      value={reminderForm.mileageInterval}
                      onChange={(e) => setReminderForm({ ...reminderForm, mileageInterval: e.target.value })}
                      placeholder="10000"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                </>
              )}

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">{t('notes')}</label>
                <textarea
                  value={reminderForm.notes}
                  onChange={(e) => setReminderForm({ ...reminderForm, notes: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowReminderForm(false)}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCreateReminder}
                disabled={!reminderForm.serviceName || createReminder.isPending}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createReminder.isPending ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        )}

        {/* Reminders Table */}
        {loadingReminders ? (
          <p className="text-sm text-gray-500">{t('loading')}</p>
        ) : !reminders || reminders.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{tr('noReminders')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-xs uppercase text-gray-500">
                  <th className="py-2 pe-4 text-start font-semibold">{tr('serviceName')}</th>
                  <th className="py-2 pe-4 text-start font-semibold">{tr('type')}</th>
                  <th className="py-2 pe-4 text-start font-semibold">{tr('nextDue')}</th>
                  <th className="py-2 pe-4 text-start font-semibold">{tr('status')}</th>
                  <th className="py-2 text-start font-semibold">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(reminders as Array<Record<string, unknown>>).map((rem) => {
                  const statusColors: Record<string, string> = {
                    active: 'bg-blue-100 text-blue-800',
                    sent: 'bg-yellow-100 text-yellow-800',
                    completed: 'bg-green-100 text-green-800',
                    cancelled: 'bg-gray-100 text-gray-600',
                  };
                  return (
                    <tr key={rem.id as string}>
                      <td className="py-3 pe-4 font-medium text-gray-900">{rem.service_name as string}</td>
                      <td className="py-3 pe-4 text-gray-600 capitalize">{rem.reminder_type as string}</td>
                      <td className="py-3 pe-4 text-gray-600">
                        {rem.next_date && <span>{rem.next_date as string}</span>}
                        {rem.next_date && rem.next_mileage && <span> / </span>}
                        {rem.next_mileage && <span>{(rem.next_mileage as number).toLocaleString()} km</span>}
                      </td>
                      <td className="py-3 pe-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[rem.status as string] ?? 'bg-gray-100'}`}>
                          {tr(`status_${rem.status as string}`)}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          {(rem.status === 'active') && (
                            <button
                              onClick={() => markSent.mutate(rem.id as string)}
                              className="text-xs text-amber-600 hover:underline"
                            >
                              {tr('markSent')}
                            </button>
                          )}
                          {(rem.status === 'active' || rem.status === 'sent') && (
                            <button
                              onClick={() => completeReminder.mutate(rem.id as string)}
                              className="text-xs text-green-600 hover:underline"
                            >
                              {tr('markCompleted')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Vehicle Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{tv('editVehicle')}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                &#x2715;
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tv('plate')}</label>
                  <input {...register('plate')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  {errors.plate && <p className="mt-1 text-sm text-red-600">{errors.plate.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tv('vin')}</label>
                  <input {...register('vin')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  {errors.vin && <p className="mt-1 text-sm text-red-600">{errors.vin.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tv('make')}</label>
                  <input {...register('make')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  {errors.make && <p className="mt-1 text-sm text-red-600">{errors.make.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tv('model')}</label>
                  <input {...register('model')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  {errors.model && <p className="mt-1 text-sm text-red-600">{errors.model.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tv('year')}</label>
                  <input {...register('year', { valueAsNumber: true })} type="number" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tv('color')}</label>
                  <input {...register('color')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tv('mileage')}</label>
                  <input {...register('mileage', { valueAsNumber: true })} type="number" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tv('fuelType')}</label>
                  <select {...register('fuelType')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
                    <option value="">-</option>
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="electric">Electric</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="lpg">LPG</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{tv('engineSize')}</label>
                  <input {...register('engineSize')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tv('notes')}</label>
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
