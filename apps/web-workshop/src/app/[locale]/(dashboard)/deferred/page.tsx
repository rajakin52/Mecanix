'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useDeferredServices, useRemindDeferred, useDeferredSummary } from '@/hooks/use-deferred';
import { formatCurrency, formatDate } from '@/lib/format';
import { SkeletonTable, EmptyState, useToast } from '@mecanix/ui-web';

const STATUSES = ['all', 'pending', 'reminded', 'converted', 'expired'];

export default function DeferredPage() {
  const toast = useToast();
  const [status, setStatus] = useState<string>('pending');
  const [priority, setPriority] = useState<string>('all');

  const { data, isLoading, isError, error } = useDeferredServices(status === 'all' ? undefined : status);
  const { data: summary } = useDeferredSummary();
  const remind = useRemindDeferred();

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const filtered = priority === 'all' ? rows : rows.filter((r) => r.priority === priority);

  const waLink = (row: Record<string, unknown>) => {
    const customer = row.customer as Record<string, unknown> | null;
    const vehicle = row.vehicle as Record<string, unknown> | null;
    const phone = (customer?.phone as string | undefined)?.replace(/[^0-9+]/g, '');
    if (!phone) return null;
    const plate = (vehicle?.plate as string) ?? '';
    const desc = (row.description as string) ?? 'recommended service';
    const cost = row.estimated_cost ? ` (aprox. ${formatCurrency(Number(row.estimated_cost))})` : '';
    const msg = `Olá ${customer?.full_name ?? ''}! Lembrando que o ${plate} tem um serviço recomendado pendente: ${desc}${cost}. Marcamos uma visita?`;
    return `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Deferred work</h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <Kpi label="Pending items" value={summary ? String(summary.totalPending) : '…'} />
        <Kpi label="Red (urgent)" value={summary ? String(summary.redCount) : '…'} color="text-red-600" />
        <Kpi label="Yellow (monitor)" value={summary ? String(summary.yellowCount) : '…'} color="text-yellow-600" />
        <Kpi
          label="Potential revenue"
          value={summary ? formatCurrency(Number(summary.potentialRevenue) || 0) : '…'}
          color="text-green-700"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {['all', 'red', 'yellow'].map((p) => (
            <button
              key={p}
              onClick={() => setPriority(p)}
              className={`rounded px-3 py-1 text-xs font-medium ${
                priority === p ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={6} cols={6} />
      ) : isError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Failed to load: {error instanceof Error ? error.message : 'unknown'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500"></th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Customer / Vehicle</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Service</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">Estimated</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Follow-up</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Reminders</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon="parts"
                      title="No items match"
                      description="Deferred services come from DVI yellow/red findings that weren't included in the estimate."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const customer = row.customer as Record<string, unknown> | null;
                  const vehicle = row.vehicle as Record<string, unknown> | null;
                  const wa = waLink(row);
                  const prio = row.priority as string;
                  return (
                    <tr key={row.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${
                            prio === 'red' ? 'bg-red-500' : 'bg-yellow-400'
                          }`}
                          title={prio}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-gray-900">{(customer?.full_name as string) ?? '—'}</div>
                        {vehicle ? (
                          <div className="text-xs text-gray-500">
                            <span className="font-mono">{vehicle.plate as string}</span>
                            <span className="ms-1">
                              {(vehicle.make as string) ?? ''} {(vehicle.model as string) ?? ''}
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{row.description as string}</td>
                      <td className="px-4 py-3 text-end text-sm text-gray-700">
                        {row.estimated_cost != null ? formatCurrency(Number(row.estimated_cost)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {row.follow_up_date ? formatDate(row.follow_up_date as string) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {String(row.reminder_count ?? 0)} sent
                        <span className="ms-2 text-xs text-gray-400">({row.status as string})</span>
                      </td>
                      <td className="px-4 py-3 text-end">
                        <div className="inline-flex gap-2">
                          {wa ? (
                            <a
                              href={wa}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                            >
                              WhatsApp
                            </a>
                          ) : null}
                          {(row.status === 'pending' || row.status === 'reminded') && (
                            <button
                              onClick={async () => {
                                try {
                                  await remind.mutateAsync(row.id as string);
                                  toast.success('Reminder recorded');
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Failed');
                                }
                              }}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                            >
                              Mark reminded
                            </button>
                          )}
                          {row.original_job_card_id ? (
                            <Link
                              href={`/jobs/${row.original_job_card_id as string}`}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                            >
                              Source job
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
