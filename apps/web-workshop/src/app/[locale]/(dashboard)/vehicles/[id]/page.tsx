'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useVehicle, useUpdateVehicle } from '@/hooks/use-vehicles';
import { api } from '@/lib/api';
import { useVehicleReminders, useCreateReminder, useCompleteReminder, useMarkReminderSent } from '@/hooks/use-reminders';
import { useDocumentReminders, useCreateDocumentReminder, useRenewDocumentReminder } from '@/hooks/use-document-reminders';
import { useVehicleWarrantyCoverage } from '@/hooks/use-warranty';
import { useDeferredServices, useCreateDeferred } from '@/hooks/use-deferred';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateVehicleSchema } from '@mecanix/validators';
import type { UpdateVehicleInput } from '@mecanix/validators';
import type { UpdateVehicleDto } from '@mecanix/types';
import { Link } from '@/i18n/navigation';

export default function VehicleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const tv = useTranslations('vehicles');
  const t = useTranslations('common');
  const tr = useTranslations('reminders');
  const td = useTranslations('documentReminders');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReminderForm, setShowReminderForm] = useState(false);
  const [showDocReminderForm, setShowDocReminderForm] = useState(false);
  const [docForm, setDocForm] = useState({
    documentType: 'vehicle_license',
    documentName: '',
    expiryDate: '',
    reminderDays: '30',
    notes: '',
  });
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
  const { data: warrantyCoverage } = useVehicleWarrantyCoverage(id);
  const { data: deferredRows } = useDeferredServices(undefined, { vehicleId: id });
  const createDeferred = useCreateDeferred();
  const [deferredForm, setDeferredForm] = useState<{ description: string; cost: string; priority: 'red' | 'yellow' }>({
    description: '',
    cost: '',
    priority: 'yellow',
  });
  const [deferredOpen, setDeferredOpen] = useState(false);
  const createReminder = useCreateReminder();
  const completeReminder = useCompleteReminder();
  const markSent = useMarkReminderSent();
  const [vinLoading, setVinLoading] = useState(false);
  const { data: docReminders, isLoading: loadingDocReminders } = useDocumentReminders(id);
  const createDocReminder = useCreateDocumentReminder();
  const renewDocReminder = useRenewDocumentReminder();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<UpdateVehicleInput>({
    resolver: zodResolver(updateVehicleSchema),
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
      // VIN decode failed silently
    } finally {
      setVinLoading(false);
    }
  }, [setValue]);

  useEffect(() => {
    if (vehicle) {
      reset({
        plate: vehicle.plate,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        vin: vehicle.vin,
        fuelType: vehicle.fuel_type as 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'lpg' | undefined,
        engineSize: vehicle.engine_size,
        mileage: vehicle.mileage,
        notes: vehicle.notes,
      });
    }
  }, [vehicle, reset]);

  const onSubmit = async (formData: UpdateVehicleInput) => {
    await updateMutation.mutateAsync({ id, ...formData } as unknown as UpdateVehicleDto & { id: string });
    setShowEditModal(false);
  };

  const handleCreateDocReminder = async () => {
    if (!vehicle) return;
    await createDocReminder.mutateAsync({
      vehicleId: id,
      customerId: vehicle.customer_id,
      documentType: docForm.documentType,
      documentName: docForm.documentName,
      expiryDate: docForm.expiryDate,
      reminderDays: docForm.reminderDays ? Number(docForm.reminderDays) : undefined,
      notes: docForm.notes || undefined,
    });
    setShowDocReminderForm(false);
    setDocForm({ documentType: 'vehicle_license', documentName: '', expiryDate: '', reminderDays: '30', notes: '' });
  };

  const handleCreateReminder = async () => {
    if (!vehicle) return;
    await createReminder.mutateAsync({
      vehicleId: id,
      customerId: vehicle.customer_id,
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

  const customer = vehicle.customers;
  const photos = vehicle.photos;

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
          <h1 className="text-3xl font-bold text-gray-900 font-mono">{vehicle.plate}</h1>
          <p className="mt-1 text-gray-500">
            {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ')}
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
              <dd className="mt-1 text-sm font-mono font-medium text-gray-900">{vehicle.plate}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('vin')}</dt>
              <dd className="mt-1 text-sm font-mono text-gray-900">{vehicle.vin || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('make')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{vehicle.make}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('model')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{vehicle.model}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('year')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{vehicle.year ?? '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('color')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{vehicle.color || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('fuelType')}</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">{vehicle.fuel_type || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('engineSize')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{vehicle.engine_size || '-'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('mileage')}</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} km` : '-'}
              </dd>
            </div>
          </dl>
          {vehicle.notes && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <dt className="text-xs font-semibold uppercase text-gray-500">{tv('notes')}</dt>
              <dd className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{vehicle.notes}</dd>
            </div>
          )}
        </div>

        {/* Owner Info Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{tv('owner')}</h2>
          {customer ? (
            <div>
              <Link
                href={`/customers/${vehicle.customer_id}`}
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
                  alt={`${vehicle.plate} photo ${index + 1}`}
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-500">{tv('noPhotos')}</p>
        )}
      </div>

      {/* Warranty coverage */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Warranty coverage</h2>
          {warrantyCoverage?.active_coverage?.length ? (
            <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
              {warrantyCoverage.active_coverage.length} active
            </span>
          ) : null}
        </div>
        {!warrantyCoverage ? (
          <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
        ) : warrantyCoverage.active_coverage.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            No active warranty coverage on record.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Item</th>
                  <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Job</th>
                  <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Terms</th>
                  <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Expires</th>
                  <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Days left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {warrantyCoverage.active_coverage.map((row) => {
                  const daysLeft = row.days_remaining;
                  const colorClass =
                    daysLeft == null
                      ? 'text-gray-500'
                      : daysLeft < 14
                      ? 'text-red-600 font-semibold'
                      : daysLeft < 30
                      ? 'text-amber-600'
                      : 'text-gray-700';
                  return (
                    <tr key={`${row.kind}-${row.id}`}>
                      <td className="px-3 py-2 text-sm">
                        <span className="mr-2 inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {row.kind}
                        </span>
                        {row.description}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <Link
                          href={`/jobs/${row.job_card_id}`}
                          className="text-primary-600 hover:underline"
                        >
                          {row.job_number ?? '—'}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700">
                        {row.warranty_months != null ? `${row.warranty_months} mo` : ''}
                        {row.warranty_months != null && row.warranty_km != null ? ' / ' : ''}
                        {row.warranty_km != null ? `${(row.warranty_km / 1000).toFixed(0)}k km` : ''}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {row.expires_at ? new Date(row.expires_at).toLocaleDateString() : '—'}
                      </td>
                      <td className={`px-3 py-2 text-end text-sm ${colorClass}`}>
                        {daysLeft == null ? '—' : daysLeft}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {warrantyCoverage?.comeback_candidates && warrantyCoverage.comeback_candidates.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-800">Recent work on this vehicle (last 30 days)</p>
            <p className="mt-1 text-xs text-amber-700">
              Consider flagging a new job as a comeback if it relates to any of:
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {warrantyCoverage.comeback_candidates.map((c) => (
                <li key={c.id}>
                  <Link href={`/jobs/${c.id}`} className="text-primary-700 hover:underline">
                    {c.job_number}
                  </Link>
                  <span className="ms-2 text-amber-700">
                    {c.status} · {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Deferred (recommended but declined) work */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Deferred work</h2>
            <p className="text-xs text-gray-500">Recommended services the customer declined or postponed.</p>
          </div>
          <button
            onClick={() => setDeferredOpen(!deferredOpen)}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {deferredOpen ? 'Cancel' : 'Add item'}
          </button>
        </div>

        {deferredOpen && (
          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  value={deferredForm.description}
                  onChange={(e) => setDeferredForm({ ...deferredForm, description: e.target.value })}
                  placeholder="e.g. Rear brake pads at 40% — replace within 3 months"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Estimated cost</label>
                <input
                  type="number"
                  step="0.01"
                  value={deferredForm.cost}
                  onChange={(e) => setDeferredForm({ ...deferredForm, cost: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <select
                  value={deferredForm.priority}
                  onChange={(e) => setDeferredForm({ ...deferredForm, priority: e.target.value as 'red' | 'yellow' })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="yellow">Yellow — monitor</option>
                  <option value="red">Red — urgent</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                onClick={async () => {
                  if (!deferredForm.description.trim() || !vehicle.customer_id) return;
                  await createDeferred.mutateAsync({
                    customerId: vehicle.customer_id as string,
                    vehicleId: id,
                    description: deferredForm.description.trim(),
                    estimatedCost: deferredForm.cost ? Number(deferredForm.cost) : undefined,
                    priority: deferredForm.priority,
                  });
                  setDeferredForm({ description: '', cost: '', priority: 'yellow' });
                  setDeferredOpen(false);
                }}
                disabled={createDeferred.isPending}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createDeferred.isPending ? 'Saving…' : 'Add deferred item'}
              </button>
            </div>
          </div>
        )}

        {!deferredRows || deferredRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No deferred items on record.</p>
        ) : (
          <ul className="divide-y">
            {deferredRows.map((d) => {
              const row = d as unknown as Record<string, unknown>;
              return (
                <li key={row.id as string} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                        row.priority === 'red' ? 'bg-red-500' : 'bg-yellow-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{row.description as string}</div>
                      <div className="text-xs text-gray-500">
                        {row.follow_up_date ? `Follow-up: ${new Date(row.follow_up_date as string).toLocaleDateString()}` : 'No follow-up set'}
                        <span className="ms-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                          {row.status as string}
                        </span>
                        {(row.reminder_count as number) > 0 ? (
                          <span className="ms-2 text-gray-400">{row.reminder_count as number} reminders</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-end text-sm">
                    {row.estimated_cost != null ? (
                      <span className="font-medium text-gray-900">{Number(row.estimated_cost).toFixed(2)}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
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
                {reminders.map((rem) => {
                  const statusColors: Record<string, string> = {
                    active: 'bg-blue-100 text-blue-800',
                    sent: 'bg-yellow-100 text-yellow-800',
                    completed: 'bg-green-100 text-green-800',
                    cancelled: 'bg-gray-100 text-gray-600',
                  };
                  return (
                    <tr key={rem.id}>
                      <td className="py-3 pe-4 font-medium text-gray-900">{rem.service_name}</td>
                      <td className="py-3 pe-4 text-gray-600 capitalize">{rem.reminder_type}</td>
                      <td className="py-3 pe-4 text-gray-600">
                        {rem.next_date && <span>{rem.next_date}</span>}
                        {rem.next_date && rem.next_mileage && <span> / </span>}
                        {rem.next_mileage && <span>{rem.next_mileage.toLocaleString()} km</span>}
                      </td>
                      <td className="py-3 pe-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[rem.status] ?? 'bg-gray-100'}`}>
                          {tr(`status_${rem.status}`)}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          {(rem.status === 'active') && (
                            <button
                              onClick={() => markSent.mutate(rem.id)}
                              className="text-xs text-amber-600 hover:underline"
                            >
                              {tr('markSent')}
                            </button>
                          )}
                          {(rem.status === 'active' || rem.status === 'sent') && (
                            <button
                              onClick={() => completeReminder.mutate(rem.id)}
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

      {/* Document Reminders */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{td('title')}</h2>
          <button
            onClick={() => setShowDocReminderForm(!showDocReminderForm)}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {td('addReminder')}
          </button>
        </div>

        {/* Inline Add Document Reminder Form */}
        {showDocReminderForm && (
          <div className="mb-6 rounded-md border border-gray-200 bg-gray-50 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">{td('documentType')}</label>
                <select
                  value={docForm.documentType}
                  onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="vehicle_license">{td('type_vehicle_license')}</option>
                  <option value="insurance_policy">{td('type_insurance_policy')}</option>
                  <option value="inspection_certificate">{td('type_inspection_certificate')}</option>
                  <option value="driving_license">{td('type_driving_license')}</option>
                  <option value="road_tax">{td('type_road_tax')}</option>
                  <option value="other">{td('type_other')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{td('documentName')}</label>
                <input
                  value={docForm.documentName}
                  onChange={(e) => setDocForm({ ...docForm, documentName: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{td('expiryDate')}</label>
                <input
                  type="date"
                  value={docForm.expiryDate}
                  onChange={(e) => setDocForm({ ...docForm, expiryDate: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{td('reminderDays')}</label>
                <input
                  type="number"
                  value={docForm.reminderDays}
                  onChange={(e) => setDocForm({ ...docForm, reminderDays: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">{t('notes')}</label>
                <textarea
                  value={docForm.notes}
                  onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })}
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowDocReminderForm(false)} className="rounded-md border px-3 py-1.5 text-sm">
                {t('cancel')}
              </button>
              <button
                onClick={handleCreateDocReminder}
                disabled={!docForm.documentName || !docForm.expiryDate || createDocReminder.isPending}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createDocReminder.isPending ? t('loading') : t('save')}
              </button>
            </div>
          </div>
        )}

        {/* Document Reminders Table */}
        {loadingDocReminders ? (
          <p className="text-sm text-gray-500">{t('loading')}</p>
        ) : !docReminders || docReminders.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{td('noReminders')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-xs uppercase text-gray-500">
                  <th className="py-2 pe-4 text-start font-semibold">{td('documentName')}</th>
                  <th className="py-2 pe-4 text-start font-semibold">{td('documentType')}</th>
                  <th className="py-2 pe-4 text-start font-semibold">{td('expiryDate')}</th>
                  <th className="py-2 pe-4 text-start font-semibold">{td('status')}</th>
                  <th className="py-2 text-start font-semibold">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {docReminders.map((rem) => {
                  const statusColors: Record<string, string> = {
                    active: 'bg-blue-100 text-blue-800',
                    reminded: 'bg-yellow-100 text-yellow-800',
                    renewed: 'bg-green-100 text-green-800',
                    expired: 'bg-red-100 text-red-800',
                  };
                  return (
                    <tr key={rem.id}>
                      <td className="py-3 pe-4 font-medium text-gray-900">{rem.document_name}</td>
                      <td className="py-3 pe-4 text-gray-600">{td(`type_${rem.document_type}`)}</td>
                      <td className="py-3 pe-4 text-gray-600">{rem.expiry_date}</td>
                      <td className="py-3 pe-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[rem.status] ?? 'bg-gray-100'}`}>
                          {td(`status_${rem.status}`)}
                        </span>
                      </td>
                      <td className="py-3">
                        {(rem.status === 'active' || rem.status === 'reminded') && (
                          <button
                            onClick={() => renewDocReminder.mutate(rem.id)}
                            className="text-xs text-green-600 hover:underline"
                          >
                            {td('markRenewed')}
                          </button>
                        )}
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
                        {t('loading')}
                      </span>
                    )}
                  </div>
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
