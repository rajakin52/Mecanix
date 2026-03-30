'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDebounce } from '@/hooks/use-debounce';
import { useJobs, useCreateJob, useTechnicians } from '@/hooks/use-jobs';
import { useCustomers } from '@/hooks/use-customers';
import { useVehicles } from '@/hooks/use-vehicles';
import { Link } from '@/i18n/navigation';
import { SkeletonTable, StatusBadge, useToast } from '@mecanix/ui-web';

const STATUSES = [
  { key: undefined, label: 'All' },
  { key: 'received', label: 'Received' },
  { key: 'diagnosing', label: 'Diagnosing' },
  { key: 'awaiting_approval', label: 'Awaiting Approval' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'awaiting_parts', label: 'Awaiting Parts' },
  { key: 'quality_check', label: 'Quality Check' },
  { key: 'ready', label: 'Ready' },
  { key: 'invoiced', label: 'Invoiced' },
] as const;

export default function JobsPage() {
  const t = useTranslations('jobs');
  const tc = useTranslations('common');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [activeStatus, setActiveStatus] = useState<string | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useJobs(page, debouncedSearch, activeStatus);
  const createMutation = useCreateJob();

  // Form state for new job card
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formVehicleId, setFormVehicleId] = useState('');
  const [formProblem, setFormProblem] = useState('');
  const [formTechId, setFormTechId] = useState('');
  const [formLabels, setFormLabels] = useState('');
  const [formInsurance, setFormInsurance] = useState(false);
  const [formTaxable, setFormTaxable] = useState(true);

  // Fetch customers and technicians for modal dropdowns
  const { data: customersData } = useCustomers(1, '');
  const { data: vehiclesData } = useVehicles(1, '', formCustomerId || undefined);
  const { data: techData } = useTechnicians();

  const resetForm = () => {
    setFormCustomerId('');
    setFormVehicleId('');
    setFormProblem('');
    setFormTechId('');
    setFormLabels('');
    setFormInsurance(false);
    setFormTaxable(true);
  };

  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  const handleCreate = async () => {
    if (!formCustomerId || !formVehicleId || !formProblem) return;
    try {
      setFormError(null);
      await createMutation.mutateAsync({
        customerId: formCustomerId,
        vehicleId: formVehicleId,
        reportedProblem: formProblem,
        primaryTechnicianId: formTechId || undefined,
        labels: formLabels ? formLabels.split(',').map((l) => l.trim()).filter(Boolean) : [],
        isInsurance: formInsurance,
        isTaxable: formTaxable,
      });
      setShowModal(false);
      resetForm();
      toast.success('Saved successfully!');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create job');
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(undefined, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <Link href="/jobs/new"
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          {t('newJob')}
        </Link>
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200">
        {STATUSES.map((s) => (
          <button
            key={s.label}
            onClick={() => { setActiveStatus(s.key); setPage(1); }}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeStatus === s.key
                ? 'border-b-2 border-primary-600 text-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
            {data?.meta && s.key === activeStatus && (
              <span className="ms-1.5 inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700">
                {data.meta.total}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
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
        <SkeletonTable rows={8} cols={7} />
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('jobNumber')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('vehicles')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tc('customers')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('status')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('assignedTo')}</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('total')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('dateOpened')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {data?.data && data.data.length > 0 ? (
                  data.data.map((job: Record<string, unknown>) => (
                    <tr key={job.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/jobs/${job.id as string}`}>
                          {job.job_number as string}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {((job.vehicle ?? job.vehicles) as Record<string, string> | undefined)?.plate ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {((job.customer ?? job.customers) as Record<string, string> | undefined)?.full_name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={job.status as string} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {((job.primary_technician ?? job.technicians) as Record<string, string> | null | undefined)?.full_name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-end text-sm font-medium text-gray-900">
                        {formatCurrency(job.grand_total as number)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(job.date_opened as string).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                      {t('noJobs')}
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

      {/* New Job Card Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t('newJob')}</h2>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-gray-400 hover:text-gray-600">
                &#x2715;
              </button>
            </div>
            <div className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
              )}
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('selectCustomer')}</label>
                <select
                  value={formCustomerId}
                  onChange={(e) => { setFormCustomerId(e.target.value); setFormVehicleId(''); }}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">{t('selectCustomer')}</option>
                  {(customersData?.data as Array<Record<string, unknown>> | undefined)?.map((c) => (
                    <option key={c.id as string} value={c.id as string}>
                      {c.full_name as string}
                    </option>
                  ))}
                </select>
              </div>

              {/* Vehicle (filtered by customer) */}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('selectVehicle')}</label>
                <select
                  value={formVehicleId}
                  onChange={(e) => setFormVehicleId(e.target.value)}
                  disabled={!formCustomerId}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 disabled:opacity-50"
                >
                  <option value="">{t('selectVehicle')}</option>
                  {(vehiclesData?.data as Array<Record<string, unknown>> | undefined)?.map((v) => (
                    <option key={v.id as string} value={v.id as string}>
                      {v.plate as string} - {v.make as string} {v.model as string}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reported problem */}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('reportedProblem')}</label>
                <textarea
                  value={formProblem}
                  onChange={(e) => setFormProblem(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              {/* Technician */}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('selectTechnician')}</label>
                <select
                  value={formTechId}
                  onChange={(e) => setFormTechId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="">{t('selectTechnician')}</option>
                  {(techData as Array<Record<string, unknown>> | undefined)?.map((tech) => (
                    <option key={tech.id as string} value={tech.id as string}>
                      {tech.full_name as string}
                    </option>
                  ))}
                </select>
              </div>

              {/* Labels */}
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('labels')}</label>
                <input
                  value={formLabels}
                  onChange={(e) => setFormLabels(e.target.value)}
                  placeholder="engine, brakes, electrical"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              {/* Toggles */}
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formInsurance}
                    onChange={(e) => setFormInsurance(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  {t('insurance')}
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formTaxable}
                    onChange={(e) => setFormTaxable(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  {t('taxable')}
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="rounded-md border px-4 py-2 text-sm"
                >
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !formCustomerId || !formVehicleId || !formProblem}
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
