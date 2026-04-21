'use client';

import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useAuditLog, useAuditActions, type AuditLogRow } from '@/hooks/use-audit-log';
import { SkeletonTable } from '@mecanix/ui-web';

const ACTION_BADGES: Record<string, string> = {
  'settings.updated':    'bg-blue-100 text-blue-700',
  'credit_note.issued':  'bg-amber-100 text-amber-700',
  'branch.created':      'bg-green-100 text-green-700',
  'branch.updated':      'bg-blue-100 text-blue-700',
  'branch.deactivated':  'bg-red-100 text-red-700',
  'stock.transferred':   'bg-purple-100 text-purple-700',
};

export default function AuditLogPage() {
  const [action, setAction] = useState<string>('');
  const [entityType, setEntityType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading } = useAuditLog({
    action: action || undefined,
    entityType: entityType || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });
  const { data: actions } = useAuditActions();

  const rows = (data ?? []) as AuditLogRow[];

  return (
    <div>
      <div className="mb-4">
        <Link href="/settings" className="text-sm text-primary-600 hover:underline">
          &larr; Settings
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Audit log</h1>
        <p className="mt-1 text-sm text-gray-600">
          Append-only record of high-value mutations. Every settings change, credit note,
          branch change, and stock transfer is captured here with the actor, timestamp, and
          before/after snapshot when relevant.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All actions</option>
            {(actions ?? []).map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Entity type</label>
          <input
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            placeholder="e.g. invoice"
            className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">From</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">To</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={4} />
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No entries match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">When</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Actor</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Action</th>
                <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Summary</th>
                <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rows.map((r) => {
                const open = expanded === r.id;
                const actor = r.user?.full_name ?? r.user?.email ?? r.actor_name ?? 'system';
                const badge = ACTION_BADGES[r.action] ?? 'bg-gray-100 text-gray-700';
                return (
                  <>
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-600 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900">{actor}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}>
                          {r.action}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {r.summary ?? '—'}
                        {r.entity_type ? (
                          <span className="ms-2 text-xs text-gray-400">
                            ({r.entity_type})
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-end">
                        <button
                          onClick={() => setExpanded(open ? null : r.id)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          {open ? 'Hide' : 'Details'}
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr key={`${r.id}-detail`} className="bg-gray-50">
                        <td colSpan={5} className="px-4 py-3 text-xs text-gray-700">
                          <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {r.entity_id ? (
                              <div>
                                <dt className="font-semibold text-gray-500">Entity ID</dt>
                                <dd className="font-mono">{r.entity_id}</dd>
                              </div>
                            ) : null}
                            {r.ip_address ? (
                              <div>
                                <dt className="font-semibold text-gray-500">IP</dt>
                                <dd className="font-mono">{r.ip_address}</dd>
                              </div>
                            ) : null}
                          </dl>
                          {r.before_state ? (
                            <div className="mt-3">
                              <div className="font-semibold text-gray-500">Before</div>
                              <pre className="mt-1 overflow-x-auto rounded-md bg-white border border-gray-200 p-2 font-mono">
                                {JSON.stringify(r.before_state, null, 2)}
                              </pre>
                            </div>
                          ) : null}
                          {r.after_state ? (
                            <div className="mt-3">
                              <div className="font-semibold text-gray-500">After</div>
                              <pre className="mt-1 overflow-x-auto rounded-md bg-white border border-gray-200 p-2 font-mono">
                                {JSON.stringify(r.after_state, null, 2)}
                              </pre>
                            </div>
                          ) : null}
                          {Object.keys(r.metadata ?? {}).length > 0 ? (
                            <div className="mt-3">
                              <div className="font-semibold text-gray-500">Metadata</div>
                              <pre className="mt-1 overflow-x-auto rounded-md bg-white border border-gray-200 p-2 font-mono">
                                {JSON.stringify(r.metadata, null, 2)}
                              </pre>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
