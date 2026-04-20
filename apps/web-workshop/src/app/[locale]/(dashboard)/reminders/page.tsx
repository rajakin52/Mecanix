'use client';

import { useState } from 'react';
import { useReminders, useDueReminders, useMarkReminderSent, useCompleteReminder } from '@/hooks/use-reminders';
import { useDocumentReminders } from '@/hooks/use-document-reminders';
import { formatDate } from '@/lib/format';
import { SkeletonTable, useToast } from '@mecanix/ui-web';

const TABS = [
  { id: 'service' as const, label: 'Service reminders' },
  { id: 'documents' as const, label: 'Document expiries' },
];
const STATUSES = ['all', 'active', 'sent', 'completed', 'cancelled'];

export default function RemindersPage() {
  const [tab, setTab] = useState<'service' | 'documents'>('service');
  const [status, setStatus] = useState<string>('active');
  const [dueOnly, setDueOnly] = useState(false);

  const toast = useToast();

  const { data: allService, isLoading: loadingService } = useReminders(undefined, status === 'all' ? undefined : status);
  const { data: dueService } = useDueReminders();
  const serviceReminders = ((dueOnly ? dueService : allService) ?? []) as unknown as Array<Record<string, unknown>>;

  const markSent = useMarkReminderSent();
  const complete = useCompleteReminder();

  const { data: docs, isLoading: loadingDocs } = useDocumentReminders();
  const docReminders = (docs ?? []) as unknown as Array<Record<string, unknown>>;

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold text-gray-900">Reminders</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md border border-gray-200 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition ${
                tab === t.id ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'service' && (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
              Due only
            </label>
            {!dueOnly && (
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
            )}
          </>
        )}
      </div>

      {tab === 'service' ? (
        loadingService ? (
          <SkeletonTable rows={6} cols={6} />
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Vehicle</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Service</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Trigger</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {serviceReminders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">
                      No reminders
                    </td>
                  </tr>
                ) : (
                  serviceReminders.map((r) => {
                    const v = r.vehicles as Record<string, unknown> | null;
                    const c = r.customers as Record<string, unknown> | null;
                    const rStatus = r.status as string;
                    return (
                      <tr key={r.id as string} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{(c?.full_name as string) ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {v ? (
                            <>
                              <div className="font-mono">{v.plate as string}</div>
                              <div className="text-xs text-gray-500">
                                {(v.make as string) ?? ''} {(v.model as string) ?? ''}
                              </div>
                            </>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{r.service_name as string}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {r.next_mileage != null ? <div>{Number(r.next_mileage).toLocaleString()} km</div> : null}
                          {r.next_date ? <div className="text-xs">{formatDate(r.next_date as string)}</div> : null}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              rStatus === 'active'
                                ? 'bg-blue-100 text-blue-700'
                                : rStatus === 'sent'
                                ? 'bg-yellow-100 text-yellow-700'
                                : rStatus === 'completed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {rStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end">
                          {rStatus === 'active' && (
                            <button
                              onClick={async () => {
                                try {
                                  await markSent.mutateAsync(r.id as string);
                                  toast.success('Marked as sent');
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Failed');
                                }
                              }}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              Mark sent
                            </button>
                          )}
                          {rStatus === 'sent' && (
                            <button
                              onClick={async () => {
                                try {
                                  await complete.mutateAsync(r.id as string);
                                  toast.success('Completed');
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Failed');
                                }
                              }}
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              Complete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )
      ) : loadingDocs ? (
        <SkeletonTable rows={6} cols={5} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Vehicle</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Document</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Expires</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {docReminders.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                    No document reminders
                  </td>
                </tr>
              ) : (
                docReminders.map((r) => {
                  const v = r.vehicles as Record<string, unknown> | null;
                  return (
                    <tr key={r.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {v ? (
                          <>
                            <div className="font-mono">{v.plate as string}</div>
                            <div className="text-xs text-gray-500">
                              {(v.make as string) ?? ''} {(v.model as string) ?? ''}
                            </div>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{r.document_type as string}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {r.expires_at ? formatDate(r.expires_at as string) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{(r.status as string) ?? '-'}</td>
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
