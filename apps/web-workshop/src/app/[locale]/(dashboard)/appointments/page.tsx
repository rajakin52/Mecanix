'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAppointmentsByDate,
  useAvailableSlots,
  useCreateAppointment,
  useUpdateAppointmentStatus,
} from '@/hooks/use-appointments';
import { useCustomers } from '@/hooks/use-customers';
import { useVehicles } from '@/hooks/use-vehicles';
import { useTechnicians } from '@/hooks/use-jobs';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-indigo-100 text-indigo-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-400',
  no_show: 'bg-red-100 text-red-700',
};

const SERVICE_TYPES = [
  'Oil Change',
  'Brake Service',
  'Engine Repair',
  'Body Work',
  'Electrical',
  'Inspection',
  'General Service',
  'Other',
];

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: '4 hours', value: 240 },
  { label: 'Full day', value: 480 },
];

const HOURS = Array.from({ length: 20 }, (_, i) => 8 * 60 + i * 30); // 8:00 to 17:30

function formatTime(time: string) {
  return time.slice(0, 5);
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function AppointmentsPage() {
  const t = useTranslations('appointments');
  const tc = useTranslations('common');

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [viewMode, setViewMode] = useState<'day' | 'list'>('day');
  const [showModal, setShowModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Form state
  const [formDate, setFormDate] = useState(today);
  const [formTime, setFormTime] = useState('09:00');
  const [formDuration, setFormDuration] = useState(60);
  const [formServiceType, setFormServiceType] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formVehicleId, setFormVehicleId] = useState('');
  const [formTechnicianId, setFormTechnicianId] = useState('');
  const [formBayNumber, setFormBayNumber] = useState('');
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formCustomerPhone, setFormCustomerPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isWalkIn, setIsWalkIn] = useState(false);

  const { data: appointments, isLoading } = useAppointmentsByDate(selectedDate);
  const { data: availableSlots } = useAvailableSlots(formDate, formDuration);
  const { data: customersData } = useCustomers(1, customerSearch);
  const customers = customersData?.data ?? [];
  const { data: vehiclesData } = useVehicles(1, '', formCustomerId || undefined);
  const vehicles = vehiclesData?.data ?? [];
  const { data: technicians } = useTechnicians();

  const createMutation = useCreateAppointment();
  const statusMutation = useUpdateAppointmentStatus();

  const resetForm = () => {
    setFormDate(selectedDate);
    setFormTime('09:00');
    setFormDuration(60);
    setFormServiceType('');
    setFormDescription('');
    setFormCustomerId('');
    setFormVehicleId('');
    setFormTechnicianId('');
    setFormBayNumber('');
    setFormCustomerName('');
    setFormCustomerPhone('');
    setFormNotes('');
    setIsWalkIn(false);
    setCustomerSearch('');
  };

  const handleCreate = async () => {
    if (!formServiceType || !formTime) return;

    const payload: Record<string, unknown> = {
      scheduledDate: formDate,
      scheduledTime: formTime,
      durationMinutes: formDuration,
      serviceType: formServiceType,
    };

    if (formDescription) payload.description = formDescription;
    if (formNotes) payload.notes = formNotes;
    if (formTechnicianId) payload.technicianId = formTechnicianId;
    if (formBayNumber) payload.bayNumber = parseInt(formBayNumber, 10);

    if (isWalkIn) {
      if (formCustomerName) payload.customerName = formCustomerName;
      if (formCustomerPhone) payload.customerPhone = formCustomerPhone;
    } else {
      if (formCustomerId) payload.customerId = formCustomerId;
      if (formVehicleId) payload.vehicleId = formVehicleId;
    }

    await createMutation.mutateAsync(payload);
    setShowModal(false);
    resetForm();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await statusMutation.mutateAsync({ id, status });
  };

  // Day view: map appointments to timeline
  const appointmentBlocks = useMemo(() => {
    if (!appointments) return [];
    return appointments.map((appt) => {
      const startMin = timeToMinutes(appt.scheduled_time);
      const endMin = startMin + appt.duration_minutes;
      return { ...appt, startMin, endMin };
    });
  }, [appointments]);

  const dayStartMin = 8 * 60;
  const dayEndMin = 18 * 60;
  const totalDayMinutes = dayEndMin - dayStartMin;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{t('title')}</h1>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          {t('newAppointment')}
        </button>
      </div>

      {/* Controls */}
      <div className="mb-6 flex items-center gap-4">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="flex rounded-md border border-gray-300">
          <button
            onClick={() => setViewMode('day')}
            className={`px-4 py-2 text-sm font-medium ${viewMode === 'day' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} rounded-l-md`}
          >
            {t('dayView')}
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm font-medium ${viewMode === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'} rounded-r-md`}
          >
            {t('listView')}
          </button>
        </div>
        <span className="text-sm text-gray-500">
          {appointments?.length ?? 0} {t('appointmentsCount')}
        </span>
      </div>

      {isLoading ? (
        <p className="text-gray-500">{tc('loading')}</p>
      ) : viewMode === 'day' ? (
        /* Day View - Timeline */
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="relative" style={{ minHeight: '600px' }}>
            {/* Time slots background */}
            {HOURS.map((min) => {
              const top = ((min - dayStartMin) / totalDayMinutes) * 100;
              return (
                <div
                  key={min}
                  className="absolute left-0 right-0 border-t border-gray-100"
                  style={{ top: `${top}%` }}
                >
                  <span className="absolute -top-2.5 left-2 text-xs text-gray-400">
                    {formatMinutes(min)}
                  </span>
                </div>
              );
            })}

            {/* Appointment blocks */}
            {appointmentBlocks.map((appt) => {
              const top = ((appt.startMin - dayStartMin) / totalDayMinutes) * 100;
              const height = (appt.duration_minutes / totalDayMinutes) * 100;
              return (
                <div
                  key={appt.id}
                  className="absolute left-16 right-4 rounded-md border border-primary-200 bg-primary-50 p-2 shadow-sm hover:shadow-md transition-shadow"
                  style={{ top: `${top}%`, height: `${Math.max(height, 3)}%` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-primary-700">
                          {formatTime(appt.scheduled_time)}
                        </span>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[appt.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {t(`status_${appt.status}`)}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium text-gray-900">
                        {appt.customer_name ?? appt.customer?.full_name ?? t('walkIn')}
                      </p>
                      {appt.vehicle && (
                        <p className="truncate text-xs text-gray-500">
                          {appt.vehicle.plate} - {appt.vehicle.make} {appt.vehicle.model}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">{appt.service_type}</p>
                      {appt.technician && (
                        <p className="text-xs text-gray-400">{appt.technician.full_name}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {appt.status === 'scheduled' && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'confirmed')}
                          className="rounded bg-indigo-500 px-2 py-0.5 text-xs text-white hover:bg-indigo-600"
                        >
                          {t('confirm')}
                        </button>
                      )}
                      {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                        <>
                          <button
                            onClick={() => handleStatusChange(appt.id, 'in_progress')}
                            className="rounded bg-yellow-500 px-2 py-0.5 text-xs text-white hover:bg-yellow-600"
                          >
                            {t('start')}
                          </button>
                          <button
                            onClick={() => handleStatusChange(appt.id, 'cancelled')}
                            className="rounded bg-gray-400 px-2 py-0.5 text-xs text-white hover:bg-gray-500"
                          >
                            {tc('cancel')}
                          </button>
                        </>
                      )}
                      {appt.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'completed')}
                          className="rounded bg-green-500 px-2 py-0.5 text-xs text-white hover:bg-green-600"
                        >
                          {t('complete')}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {appointmentBlocks.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-400">{t('noAppointments')}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* List View - Table */
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('time')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('customer')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('vehicle')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('service')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('technician')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{t('status')}</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(appointments ?? []).map((appt) => (
                <tr key={appt.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                    {formatTime(appt.scheduled_time)}
                    <span className="ml-1 text-xs text-gray-400">({appt.duration_minutes}min)</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {appt.customer_name ?? appt.customer?.full_name ?? t('walkIn')}
                    {appt.customer_phone && (
                      <span className="block text-xs text-gray-400">{appt.customer_phone}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {appt.vehicle ? `${appt.vehicle.plate} - ${appt.vehicle.make} ${appt.vehicle.model}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{appt.service_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {appt.technician?.full_name ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[appt.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {t(`status_${appt.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {appt.status === 'scheduled' && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'confirmed')}
                          className="rounded bg-indigo-500 px-2 py-1 text-xs text-white hover:bg-indigo-600"
                        >
                          {t('confirm')}
                        </button>
                      )}
                      {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                        <>
                          <button
                            onClick={() => handleStatusChange(appt.id, 'in_progress')}
                            className="rounded bg-yellow-500 px-2 py-1 text-xs text-white hover:bg-yellow-600"
                          >
                            {t('start')}
                          </button>
                          <button
                            onClick={() => handleStatusChange(appt.id, 'cancelled')}
                            className="rounded bg-gray-400 px-2 py-1 text-xs text-white hover:bg-gray-500"
                          >
                            {tc('cancel')}
                          </button>
                        </>
                      )}
                      {appt.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'completed')}
                          className="rounded bg-green-500 px-2 py-1 text-xs text-white hover:bg-green-600"
                        >
                          {t('complete')}
                        </button>
                      )}
                      {(appt.status === 'scheduled' || appt.status === 'confirmed') && (
                        <button
                          onClick={() => handleStatusChange(appt.id, 'no_show')}
                          className="rounded bg-red-400 px-2 py-1 text-xs text-white hover:bg-red-500"
                        >
                          {t('noShow')}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {(appointments ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    {t('noAppointments')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* New Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="mb-4 text-lg font-bold text-gray-900">{t('newAppointment')}</h2>

            <div className="space-y-4">
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('date')}</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">{t('time')}</label>
                  <select
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {(availableSlots ?? []).map((slot) => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                    {(!availableSlots || availableSlots.length === 0) && (
                      <option value={formTime}>{formTime}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Duration */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('duration')}</label>
                <select
                  value={formDuration}
                  onChange={(e) => setFormDuration(parseInt(e.target.value, 10))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {DURATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Service Type */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('serviceType')}</label>
                <select
                  value={formServiceType}
                  onChange={(e) => setFormServiceType(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('selectService')}</option>
                  {SERVICE_TYPES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('description')}</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Walk-in toggle */}
              <div className="flex items-center gap-2">
                <input
                  id="walkIn"
                  type="checkbox"
                  checked={isWalkIn}
                  onChange={(e) => {
                    setIsWalkIn(e.target.checked);
                    if (e.target.checked) {
                      setFormCustomerId('');
                      setFormVehicleId('');
                    } else {
                      setFormCustomerName('');
                      setFormCustomerPhone('');
                    }
                  }}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="walkIn" className="text-sm font-medium text-gray-700">{t('walkInCustomer')}</label>
              </div>

              {isWalkIn ? (
                /* Walk-in: manual name + phone */
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{tc('name')}</label>
                    <input
                      type="text"
                      value={formCustomerName}
                      onChange={(e) => setFormCustomerName(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{tc('phone')}</label>
                    <input
                      type="text"
                      value={formCustomerPhone}
                      onChange={(e) => setFormCustomerPhone(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                /* Existing customer */
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{t('customer')}</label>
                    <input
                      type="text"
                      placeholder={t('searchCustomer')}
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="mb-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                    <select
                      value={formCustomerId}
                      onChange={(e) => {
                        setFormCustomerId(e.target.value);
                        setFormVehicleId('');
                      }}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">{t('selectCustomer')}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.full_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Vehicle (filtered by customer) */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{t('vehicle')}</label>
                    <select
                      value={formVehicleId}
                      onChange={(e) => setFormVehicleId(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      disabled={!formCustomerId}
                    >
                      <option value="">{t('selectVehicle')}</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              {/* Technician */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('technician')}</label>
                <select
                  value={formTechnicianId}
                  onChange={(e) => setFormTechnicianId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('selectTechnician')}</option>
                  {(technicians ?? []).map((tech) => (
                    <option key={tech.id} value={tech.id}>{tech.full_name}</option>
                  ))}
                </select>
              </div>

              {/* Bay Number */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{t('bayNumber')}</label>
                <input
                  type="number"
                  value={formBayNumber}
                  onChange={(e) => setFormBayNumber(e.target.value)}
                  min="1"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {tc('cancel')}
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending || !formServiceType}
                className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createMutation.isPending ? tc('loading') : tc('create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
