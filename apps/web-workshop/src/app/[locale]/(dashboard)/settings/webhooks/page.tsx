'use client';

import { useState } from 'react';
import { useWebhooks, useWebhookLogs, useCreateWebhook, useUpdateWebhook, useDeleteWebhook } from '@/hooks/use-webhooks';
import { formatDate } from '@/lib/format';
import { useToast } from '@mecanix/ui-web';
import { Link } from '@/i18n/navigation';
import { SettingsPageHeader } from '@/components/settings/SettingsPrimitives';

const EVENT_OPTIONS = [
  'job.created',
  'job.status_changed',
  'job.ready',
  'invoice.created',
  'invoice.sent',
  'invoice.paid',
  'estimate.approved',
  'customer.created',
];

export default function WebhooksPage() {
  const toast = useToast();
  const { data, isLoading } = useWebhooks();
  const create = useCreateWebhook();
  const update = useUpdateWebhook();
  const del = useDeleteWebhook();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [openLogsFor, setOpenLogsFor] = useState<string | null>(null);

  const webhooks = (data ?? []) as Array<Record<string, unknown>>;

  const toggleEvent = (e: string) =>
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const handleCreate = async () => {
    if (!name || !url || events.length === 0) {
      return toast.error('Name, URL and at least one event are required');
    }
    try {
      await create.mutateAsync({ name, url, secret: secret || undefined, events });
      setName('');
      setUrl('');
      setSecret('');
      setEvents([]);
      toast.success('Webhook created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create webhook');
    }
  };

  return (
    <div className="max-w-5xl pb-16">
      <SettingsPageHeader
        eyebrow="INTEGRATIONS"
        title="Webhooks"
        description={
          <>
            HTTP callbacks for job, invoice, customer and estimate events. Each request carries an
            <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px]">X-Mecanix-Signature</code>
            header with the HMAC-SHA256 of the body signed by your secret.
          </>
        }
      />

      <p className="-mt-4 mb-6 text-xs text-gray-500">
        <Link href="/settings/integrations" className="hover:text-gray-900 hover:underline">
          ← Integrations
        </Link>
      </p>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">New webhook</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ERP sync"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/hook"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Secret <span className="text-xs text-gray-400">(optional, used for HMAC signature)</span>
            </label>
            <input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Random string"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Events</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EVENT_OPTIONS.map((e) => {
                const on = events.includes(e);
                return (
                  <button
                    key={e}
                    onClick={() => toggleEvent(e)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      on ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleCreate}
            disabled={create.isPending}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create webhook'}
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-900">Registered</h2>
      {isLoading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : webhooks.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No webhooks yet.
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w) => {
            const active = w.is_active as boolean;
            const id = w.id as string;
            const evts = (w.events as string[]) ?? [];
            return (
              <div key={id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{w.name as string}</span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {active ? 'active' : 'paused'}
                      </span>
                    </div>
                    <div className="mt-1 truncate font-mono text-xs text-gray-500">{w.url as string}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {evts.map((e) => (
                        <span key={e} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => update.mutate({ id, is_active: !active })}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => setOpenLogsFor(openLogsFor === id ? null : id)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      {openLogsFor === id ? 'Hide logs' : 'View logs'}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Delete this webhook?')) del.mutate(id);
                      }}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {openLogsFor === id && <LogsPanel id={id} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LogsPanel({ id }: { id: string }) {
  const { data, isLoading } = useWebhookLogs(id);
  const logs = (data ?? []) as Array<Record<string, unknown>>;
  return (
    <div className="mt-3 border-t pt-3">
      {isLoading ? (
        <div className="text-xs text-gray-400">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="text-xs text-gray-400">No deliveries yet.</div>
      ) : (
        <div className="max-h-60 overflow-y-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-1 text-start">Event</th>
                <th className="py-1 text-start">Status</th>
                <th className="py-1 text-start">Delivered</th>
                <th className="py-1 text-start">Response</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id as string} className="border-b border-gray-100">
                  <td className="py-1 font-mono">{l.event as string}</td>
                  <td className="py-1">
                    <span
                      className={
                        Number(l.response_status ?? 0) >= 200 && Number(l.response_status ?? 0) < 300
                          ? 'text-green-700'
                          : 'text-red-700'
                      }
                    >
                      {String(l.response_status ?? '—')}
                    </span>
                  </td>
                  <td className="py-1 text-gray-500">{formatDate(l.delivered_at as string)}</td>
                  <td className="py-1 text-gray-600 truncate max-w-xs">{(l.response_body as string) ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
