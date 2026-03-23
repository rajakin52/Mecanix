'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  useJob,
  useUpdateJobStatus,
  useLabourLines,
  useCreateLabourLine,
  usePartsLines,
  useCreatePartsLine,
  useTechnicians,
} from '@/hooks/use-jobs';

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-gray-100 text-gray-700',
  diagnosing: 'bg-blue-100 text-blue-700',
  awaiting_approval: 'bg-yellow-100 text-yellow-800',
  insurance_review: 'bg-purple-100 text-purple-700',
  in_progress: 'bg-blue-100 text-blue-700',
  awaiting_parts: 'bg-orange-100 text-orange-700',
  quality_check: 'bg-indigo-100 text-indigo-700',
  ready: 'bg-green-100 text-green-700',
  invoiced: 'bg-gray-100 text-gray-500',
};

const STATUS_TRANSITIONS: Record<string, string[]> = {
  received: ['diagnosing'],
  diagnosing: ['awaiting_approval', 'insurance_review', 'in_progress'],
  awaiting_approval: ['in_progress', 'diagnosing'],
  insurance_review: ['awaiting_approval', 'in_progress'],
  in_progress: ['awaiting_parts', 'quality_check'],
  awaiting_parts: ['in_progress'],
  quality_check: ['in_progress', 'ready'],
  ready: ['invoiced'],
  invoiced: [],
};

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status) return null;
  const cls = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('jobs');
  const tc = useTranslations('common');

  const { data: job, isLoading } = useJob(id);
  const statusMutation = useUpdateJobStatus();
  const { data: techData } = useTechnicians();

  // Labour lines
  const { data: labourLines } = useLabourLines(id);
  const createLabour = useCreateLabourLine();
  const [showLabourForm, setShowLabourForm] = useState(false);
  const [labourDesc, setLabourDesc] = useState('');
  const [labourHours, setLabourHours] = useState('');
  const [labourRate, setLabourRate] = useState('');
  const [labourTechId, setLabourTechId] = useState('');

  // Parts lines
  const { data: partsLines } = usePartsLines(id);
  const createParts = useCreatePartsLine();
  const [showPartsForm, setShowPartsForm] = useState(false);
  const [partName, setPartName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [partQty, setPartQty] = useState('1');
  const [partUnitCost, setPartUnitCost] = useState('');
  const [partMarkup, setPartMarkup] = useState('0');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat(undefined, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const handleStatusChange = (newStatus: string) => {
    statusMutation.mutate({ id, status: newStatus });
  };

  const [labourError, setLabourError] = useState<string | null>(null);

  const handleAddLabour = async () => {
    if (!labourDesc || !labourHours || !labourRate) return;
    try {
      setLabourError(null);
      await createLabour.mutateAsync({
        jobId: id,
        description: labourDesc,
        hours: parseFloat(labourHours),
        rate: parseFloat(labourRate),
        technicianId: labourTechId || undefined,
      });
      setShowLabourForm(false);
      setLabourDesc('');
      setLabourHours('');
      setLabourRate('');
      setLabourTechId('');
    } catch (err) {
      setLabourError(err instanceof Error ? err.message : 'Failed to add labour line');
    }
  };

  const [partsError, setPartsError] = useState<string | null>(null);

  const handleAddPart = async () => {
    if (!partName || !partUnitCost) return;
    try {
      setPartsError(null);
      await createParts.mutateAsync({
        jobId: id,
        partName: partName,
        partNumber: partNumber || undefined,
        quantity: parseInt(partQty, 10) || 1,
        unitCost: parseFloat(partUnitCost),
        markupPct: parseFloat(partMarkup) || 0,
      });
      setShowPartsForm(false);
      setPartName('');
      setPartNumber('');
      setPartQty('1');
      setPartUnitCost('');
      setPartMarkup('0');
    } catch (err) {
      setPartsError(err instanceof Error ? err.message : 'Failed to add parts line');
    }
  };

  if (isLoading) {
    return <p className="text-gray-500">{tc('loading')}</p>;
  }

  if (!job) {
    return <p className="text-gray-500">{t('noJobs')}</p>;
  }

  const typedJob = job as Record<string, unknown>;
  const vehicle = (typedJob.vehicle ?? typedJob.vehicles) as Record<string, string> | undefined;
  const customer = (typedJob.customer ?? typedJob.customers) as Record<string, string> | undefined;
  const technician = (typedJob.primary_technician ?? typedJob.technicians) as Record<string, string> | null | undefined;
  const currentStatus = typedJob.status as string;
  const nextStatuses = STATUS_TRANSITIONS[currentStatus] ?? [];
  const labels = (typedJob.labels as string[]) ?? [];
  const statusHistory = (typedJob.status_history as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/jobs" className="text-sm text-gray-500 hover:text-gray-700">
            &larr; {tc('back')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{typedJob.job_number as string}</h1>
          <StatusBadge status={currentStatus} />
        </div>
        {nextStatuses.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('changeStatus')}:</span>
            {nextStatuses.map((ns) => (
              <button
                key={ns}
                onClick={() => handleStatusChange(ns)}
                disabled={statusMutation.isPending}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {ns.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Customer + Vehicle */}
      <div className="flex gap-4 text-sm text-gray-600">
        {customer && (
          <span>
            <span className="font-medium">{tc('customers')}:</span>{' '}
            <Link href={`/customers/${typedJob.customer_id as string}`} className="text-primary-600 hover:underline">
              {customer.full_name}
            </Link>
          </span>
        )}
        {vehicle && (
          <span>
            <span className="font-medium">{tc('vehicles')}:</span>{' '}
            <Link href={`/vehicles/${typedJob.vehicle_id as string}`} className="text-primary-600 hover:underline">
              {vehicle.plate} - {vehicle.make} {vehicle.model}
            </Link>
          </span>
        )}
      </div>

      {/* Info Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-500">{t('reportedProblem')}</h3>
            <p className="mt-1 text-gray-900 whitespace-pre-wrap">{typedJob.reported_problem as string}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500">{t('internalNotes')}</h3>
            <p className="mt-1 text-gray-700 whitespace-pre-wrap">{(typedJob.internal_notes as string) || '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500">{t('assignedTo')}</h3>
            <p className="mt-1 text-gray-900">{technician?.full_name ?? '-'}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500">{t('dateOpened')}</h3>
            <p className="mt-1 text-gray-900">{new Date(typedJob.date_opened as string).toLocaleDateString()}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-500">{t('estimatedCompletion')}</h3>
            <p className="mt-1 text-gray-900">
              {typedJob.estimated_completion
                ? new Date(typedJob.estimated_completion as string).toLocaleDateString()
                : '-'}
            </p>
          </div>
          <div>
            <div className="flex flex-wrap gap-2">
              {typedJob.is_insurance && (
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                  {t('insurance')}
                </span>
              )}
              {typedJob.is_taxable && (
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {t('taxable')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-gray-500">{t('labels')}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {labels.map((label) => (
                <span
                  key={label}
                  className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Labour Lines */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('labourLines')}</h2>
          <button
            onClick={() => setShowLabourForm(true)}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {t('addLabour')}
          </button>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('description')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('hours')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('rate')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('subtotal')}</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('assignedTo')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(labourLines as Array<Record<string, unknown>> | undefined)?.map((line) => (
              <tr key={line.id as string}>
                <td className="px-4 py-2 text-sm text-gray-900">{line.description as string}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{line.hours as number}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{formatCurrency(line.rate as number)}</td>
                <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">{formatCurrency(line.subtotal as number)}</td>
                <td className="px-4 py-2 text-sm text-gray-600">
                  {(line.technicians as Record<string, string> | null | undefined)?.full_name ?? '-'}
                </td>
              </tr>
            ))}
            {(!labourLines || (labourLines as Array<unknown>).length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-center text-sm text-gray-400">
                  {tc('noResults')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Inline labour form */}
        {showLabourForm && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            {labourError && (
              <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{labourError}</div>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">{t('description')}</label>
                <input
                  value={labourDesc}
                  onChange={(e) => setLabourDesc(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('hours')}</label>
                <input
                  type="number"
                  step="0.25"
                  value={labourHours}
                  onChange={(e) => setLabourHours(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('rate')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={labourRate}
                  onChange={(e) => setLabourRate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">{t('selectTechnician')}</label>
                <select
                  value={labourTechId}
                  onChange={(e) => setLabourTechId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">{t('selectTechnician')}</option>
                  {(techData as Array<Record<string, unknown>> | undefined)?.map((tech) => (
                    <option key={tech.id as string} value={tech.id as string}>
                      {tech.full_name as string}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowLabourForm(false)}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                {tc('cancel')}
              </button>
              <button
                onClick={handleAddLabour}
                disabled={createLabour.isPending}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createLabour.isPending ? tc('loading') : tc('save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Parts Lines */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('partsLines')}</h2>
          <button
            onClick={() => setShowPartsForm(true)}
            className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {t('addPart')}
          </button>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('partName')}</th>
              <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">{t('partNumber')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('quantity')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('unitCost')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('markupPct')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('sellPrice')}</th>
              <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">{t('subtotal')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {(partsLines as Array<Record<string, unknown>> | undefined)?.map((line) => (
              <tr key={line.id as string}>
                <td className="px-4 py-2 text-sm text-gray-900">{line.part_name as string}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{(line.part_number as string) || '-'}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{line.quantity as number}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{formatCurrency(line.unit_cost as number)}</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{line.markup_pct as number}%</td>
                <td className="px-4 py-2 text-end text-sm text-gray-600">{formatCurrency(line.sell_price as number)}</td>
                <td className="px-4 py-2 text-end text-sm font-medium text-gray-900">{formatCurrency(line.subtotal as number)}</td>
              </tr>
            ))}
            {(!partsLines || (partsLines as Array<unknown>).length === 0) && (
              <tr>
                <td colSpan={7} className="px-4 py-4 text-center text-sm text-gray-400">
                  {tc('noResults')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Inline parts form */}
        {showPartsForm && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
            {partsError && (
              <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{partsError}</div>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">{t('partName')}</label>
                <input
                  value={partName}
                  onChange={(e) => setPartName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('partNumber')}</label>
                <input
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('quantity')}</label>
                <input
                  type="number"
                  min="1"
                  value={partQty}
                  onChange={(e) => setPartQty(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('unitCost')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={partUnitCost}
                  onChange={(e) => setPartUnitCost(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('markupPct')}</label>
                <input
                  type="number"
                  step="1"
                  value={partMarkup}
                  onChange={(e) => setPartMarkup(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setShowPartsForm(false)}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                {tc('cancel')}
              </button>
              <button
                onClick={handleAddPart}
                disabled={createParts.isPending}
                className="rounded-md bg-primary-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {createParts.isPending ? tc('loading') : tc('save')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Totals Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('grandTotal')}</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('labourTotal')}</span>
            <span className="font-medium text-gray-900">{formatCurrency(typedJob.labour_total as number)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('partsTotal')}</span>
            <span className="font-medium text-gray-900">{formatCurrency(typedJob.parts_total as number)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">{t('taxAmount')}</span>
            <span className="font-medium text-gray-900">{formatCurrency(typedJob.tax_amount as number)}</span>
          </div>
          <div className="border-t border-gray-200 pt-2">
            <div className="flex justify-between">
              <span className="text-base font-semibold text-gray-900">{t('grandTotal')}</span>
              <span className="text-base font-bold text-gray-900">{formatCurrency(typedJob.grand_total as number)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status History */}
      {statusHistory.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('statusHistory')}</h2>
          <div className="space-y-3">
            {statusHistory.map((entry, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary-500" />
                <div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={entry.status as string} />
                    <span className="text-xs text-gray-500">
                      {new Date(entry.changed_at as string).toLocaleString()}
                    </span>
                  </div>
                  {entry.changed_by_name && (
                    <p className="mt-0.5 text-xs text-gray-500">{entry.changed_by_name as string}</p>
                  )}
                  {entry.notes && (
                    <p className="mt-0.5 text-sm text-gray-600">{entry.notes as string}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
