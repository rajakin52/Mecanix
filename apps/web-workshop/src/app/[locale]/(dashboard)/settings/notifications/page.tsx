'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  SettingsPageHeader,
  SettingsSection,
} from '@/components/settings/SettingsPrimitives';
import { Loader2, MessageSquare } from 'lucide-react';

const NOTIFICATION_TYPES = [
  'job_created',
  'awaiting_approval',
  'ready_collection',
  'invoice_generated',
  'service_reminder',
  'appointment_confirmation',
  'appointment_reminder',
] as const;

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export default function NotificationsSettingsPage() {
  const t = useTranslations('settings');
  const tn = useTranslations('settingsNotifications');
  const tnr = useTranslations('notifications');

  const [toggles, setToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_TYPES.map((n) => [n, true])),
  );
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: templates } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => api.get<Record<string, Record<string, string>>>('/notifications/templates'),
  });

  useEffect(() => {
    Promise.all(
      NOTIFICATION_TYPES.map((type) =>
        api
          .get<{ key: string; value: string | null }>(`/tenants/me/settings/notifications.${type}`)
          .then((d) => [type, d.value === 'false' ? false : true] as const)
          .catch(() => [type, true] as const),
      ),
    )
      .then((pairs) => {
        setToggles(Object.fromEntries(pairs));
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveToggle(type: NotificationType, next: boolean) {
    const prev = toggles[type];
    setToggles((t) => ({ ...t, [type]: next }));
    setPending((p) => ({ ...p, [type]: true }));
    try {
      await api.put(`/tenants/me/settings/notifications.${type}`, {
        value: String(next),
      });
    } catch {
      // revert on error
      setToggles((t) => ({ ...t, [type]: prev ?? true }));
    } finally {
      setPending((p) => ({ ...p, [type]: false }));
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-20 rounded bg-gray-100" />
        <div className="h-[480px] rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl pb-16">
      <SettingsPageHeader
        eyebrow={t('eyebrow')}
        title={tn('title')}
        description={tn('description')}
      />

      <SettingsSection
        title={tn('channelTitle')}
        description={tn('channelDescription')}
        sensitivity="operational"
      >
        <div className="space-y-2">
          {NOTIFICATION_TYPES.map((type) => {
            const on = toggles[type] ?? true;
            const isPending = pending[type];
            const isExpanded = expanded === type;
            const template = templates?.[type];
            return (
              <div
                key={type}
                className="rounded-md border border-gray-200 bg-white transition hover:border-gray-300"
              >
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                      <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {tnr(type)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : type)}
                        className="mt-0.5 text-xs text-gray-500 hover:text-gray-900 hover:underline"
                      >
                        {isExpanded ? tn('hidePreview') : tn('showPreview')}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => saveToggle(type, !on)}
                    disabled={isPending}
                    className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                      on ? 'bg-gray-900' : 'bg-gray-200'
                    } ${isPending ? 'opacity-70' : ''}`}
                    aria-pressed={on}
                  >
                    {isPending ? (
                      <Loader2 className="mx-auto h-3 w-3 animate-spin text-white" />
                    ) : (
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                          on ? 'translate-x-4' : 'translate-x-0.5'
                        }`}
                      />
                    )}
                  </button>
                </div>

                {isExpanded && template && (
                  <div className="space-y-1.5 border-t border-gray-100 bg-gray-50/50 px-4 py-3">
                    {Object.entries(template).map(([lang, text]) => (
                      <div key={lang} className="flex items-start gap-2 text-xs">
                        <span className="mt-1 inline-flex min-w-[24px] items-center justify-center rounded bg-white px-1.5 py-0.5 font-mono font-semibold text-gray-500 uppercase ring-1 ring-gray-200">
                          {lang}
                        </span>
                        <p className="flex-1 whitespace-pre-wrap break-words font-mono text-xs text-gray-700">
                          {text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-gray-400">{tn('backendNote')}</p>
      </SettingsSection>
    </div>
  );
}
