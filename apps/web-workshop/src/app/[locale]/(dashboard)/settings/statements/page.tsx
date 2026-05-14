'use client';

import { useEffect, useState } from 'react';
import { Button, useToast } from '@mecanix/ui-web';
import { Loader2, Mail, MessageSquare, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import {
  SettingsPageHeader,
  SettingsSection,
  SettingsField,
  SettingsFooter,
} from '@/components/settings/SettingsPrimitives';

interface SoaSettings {
  enabled: boolean;
  send_day: number;
  send_hour_utc: number;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  subject_template: string;
  intro_template: string;
  whatsapp_fallback: boolean;
}

interface SoaSendRow {
  customer_id: string;
  customer_name: string;
  channel: 'email' | 'whatsapp' | 'skipped';
  recipient: string | null;
  status:
    | 'sent'
    | 'failed'
    | 'skipped_no_balance'
    | 'skipped_no_contact'
    | 'skipped_no_provider';
  error?: string;
  outstanding: number;
  open_invoices: number;
}

interface SoaBatchResult {
  batch_id: string;
  processed: number;
  sent_email: number;
  sent_whatsapp: number;
  failed: number;
  skipped: number;
  results: SoaSendRow[];
}

interface SoaBatchSummary {
  batch_id: string;
  triggered_by: string;
  started_at: string;
  total: number;
  sent_email: number;
  sent_whatsapp: number;
  failed: number;
  skipped: number;
}

const DEFAULTS: SoaSettings = {
  enabled: false,
  send_day: 1,
  send_hour_utc: 7,
  from_name: null,
  from_email: null,
  reply_to: null,
  subject_template: 'Statement of Account — {{month}}',
  intro_template:
    'Dear {{customer_name}},\n\nPlease find your statement of account attached. Your current outstanding balance is {{total_outstanding}}.\n\nThank you for your business.',
  whatsapp_fallback: true,
};

export default function StatementsSettingsPage() {
  const toast = useToast();
  const [s, setS] = useState<SoaSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SoaBatchResult | null>(null);
  const [history, setHistory] = useState<SoaBatchSummary[]>([]);

  const refreshHistory = () => {
    api.get<SoaBatchSummary[]>('/reports/statements/send-history')
      .then(setHistory)
      .catch(() => {/* ignore */});
  };

  useEffect(() => {
    Promise.all([
      api.get<SoaSettings>('/reports/statements/settings'),
      api.get<SoaBatchSummary[]>('/reports/statements/send-history'),
    ])
      .then(([settings, hist]) => {
        setS({ ...DEFAULTS, ...settings });
        setHistory(hist);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.post<SoaSettings>('/reports/statements/settings', s);
      setS({ ...DEFAULTS, ...updated });
      toast.success('Statement settings saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const runNow = async (test: boolean) => {
    setSending(true);
    setError(null);
    try {
      const result = await api.post<SoaBatchResult>('/reports/statements/send', {
        test,
      });
      setLastResult(result);
      toast.success(
        `Sent ${result.sent_email} email · ${result.sent_whatsapp} WhatsApp · ${result.failed} failed · ${result.skipped} skipped`,
      );
      refreshHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <SettingsPageHeader
        eyebrow="Financial"
        title="Customer statements (SOA)"
        description="Schedule a monthly Statement of Account email to every customer with an open balance. The PDF is attached and the body greets the customer by name. If a customer has no email, the system can send a WhatsApp notice instead."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <SettingsSection
            title="Schedule"
            description="The platform's daily cron picks tenants whose day matches today (UTC). If you choose day 31, February sends on the 28th/29th."
          >
            <SettingsField label="Enabled" hint="Off = no automatic sends. Manual 'Send now' still works.">
              <button
                type="button"
                onClick={() => setS({ ...s, enabled: !s.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  s.enabled ? 'bg-primary-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    s.enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </SettingsField>

            <SettingsField label="Day of month" hint="1–31. Sends only on this day.">
              <input
                type="number"
                min={1}
                max={31}
                value={s.send_day}
                onChange={(e) => setS({ ...s, send_day: Number(e.target.value) || 1 })}
                className="block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </SettingsField>

            <SettingsField label="Send hour (UTC)" hint="0–23. The platform cron runs daily; the hour is informational.">
              <input
                type="number"
                min={0}
                max={23}
                value={s.send_hour_utc}
                onChange={(e) => setS({ ...s, send_hour_utc: Number(e.target.value) || 0 })}
                className="block w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </SettingsField>
          </SettingsSection>

          <SettingsSection
            title="Sender identity"
            description="What customers see in the From line. Leaving the email blank uses the default verified domain configured platform-wide."
          >
            <SettingsField label="From name" hint="Leave blank to use the workshop name">
              <input
                type="text"
                value={s.from_name ?? ''}
                onChange={(e) => setS({ ...s, from_name: e.target.value })}
                placeholder="e.g. Workshop Accounts"
                className="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </SettingsField>
            <SettingsField label="From email" hint="Must be on a verified domain in Resend">
              <input
                type="email"
                value={s.from_email ?? ''}
                onChange={(e) => setS({ ...s, from_email: e.target.value })}
                placeholder="noreply@your-domain.com"
                className="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </SettingsField>
            <SettingsField label="Reply-to" hint="Replies route here instead of From">
              <input
                type="email"
                value={s.reply_to ?? ''}
                onChange={(e) => setS({ ...s, reply_to: e.target.value })}
                placeholder="accounts@your-domain.com"
                className="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </SettingsField>
          </SettingsSection>

          <SettingsSection
            title="Email template"
            description="Available variables: {{customer_name}}, {{tenant_name}}, {{month}}, {{total_outstanding}}"
          >
            <SettingsField label="Subject">
              <input
                type="text"
                value={s.subject_template}
                onChange={(e) => setS({ ...s, subject_template: e.target.value })}
                className="block w-full max-w-2xl rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </SettingsField>
            <SettingsField label="Intro paragraph" hint="Plain text. Newlines preserved.">
              <textarea
                rows={6}
                value={s.intro_template}
                onChange={(e) => setS({ ...s, intro_template: e.target.value })}
                className="block w-full max-w-2xl rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              />
            </SettingsField>
          </SettingsSection>

          <SettingsSection
            title="Fallback channel"
            description="When a customer has no email on file (or the email send fails), the platform can deliver a WhatsApp notice using the approved 'soa_monthly_notice' template. The full statement PDF cannot ride on a template message — the WhatsApp notice tells the customer to expect a follow-up email."
          >
            <SettingsField label="WhatsApp fallback">
              <button
                type="button"
                onClick={() => setS({ ...s, whatsapp_fallback: !s.whatsapp_fallback })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  s.whatsapp_fallback ? 'bg-primary-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    s.whatsapp_fallback ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </SettingsField>
          </SettingsSection>

          {error && (
            <div className="mb-3 flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <SettingsFooter>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </SettingsFooter>

          <SettingsSection
            title="Run now"
            description="Send statements immediately to every customer with an open balance. Use this to test wiring or push a one-off batch outside the schedule."
          >
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => runNow(false)} disabled={sending} variant="primary">
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" /> Send to all customers with open balance
                  </>
                )}
              </Button>
              <Button onClick={() => runNow(true)} disabled={sending} variant="ghost">
                {sending ? 'Sending…' : 'Send as test (logged as test run)'}
              </Button>
            </div>

            {lastResult && (
              <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Batch {lastResult.batch_id.slice(0, 8)} · {lastResult.processed} processed
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" /> {lastResult.sent_email} email
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> {lastResult.sent_whatsapp} WhatsApp
                  </span>
                  <span className="text-red-600">{lastResult.failed} failed</span>
                  <span>{lastResult.skipped} skipped</span>
                </div>
                {lastResult.results.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-900">
                      Per-customer detail
                    </summary>
                    <table className="mt-2 w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="py-1">Customer</th>
                          <th className="py-1">Channel</th>
                          <th className="py-1">Recipient</th>
                          <th className="py-1">Status</th>
                          <th className="py-1 text-right">Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastResult.results.map((r) => (
                          <tr key={r.customer_id} className="border-t border-gray-200">
                            <td className="py-1">{r.customer_name}</td>
                            <td className="py-1">{r.channel}</td>
                            <td className="py-1 truncate text-gray-500" style={{ maxWidth: 200 }}>
                              {r.recipient ?? '—'}
                            </td>
                            <td className="py-1">
                              {r.status === 'sent' ? (
                                <span className="text-emerald-600">sent</span>
                              ) : r.status === 'failed' ? (
                                <span className="text-red-600" title={r.error}>
                                  failed
                                </span>
                              ) : (
                                <span className="text-gray-400">{r.status}</span>
                              )}
                            </td>
                            <td className="py-1 text-right tabular-nums">
                              {r.outstanding.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>
            )}
          </SettingsSection>

          <SettingsSection
            title="Recent runs"
            description="Last 20 batches across cron, manual, and test triggers."
          >
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No runs yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="py-1">When</th>
                    <th className="py-1">Trigger</th>
                    <th className="py-1 text-right">Email</th>
                    <th className="py-1 text-right">WhatsApp</th>
                    <th className="py-1 text-right">Failed</th>
                    <th className="py-1 text-right">Skipped</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((b) => (
                    <tr key={b.batch_id} className="border-t border-gray-200">
                      <td className="py-1 text-gray-700">
                        {new Date(b.started_at).toLocaleString()}
                      </td>
                      <td className="py-1">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                          {b.triggered_by}
                        </span>
                      </td>
                      <td className="py-1 text-right tabular-nums">{b.sent_email}</td>
                      <td className="py-1 text-right tabular-nums">{b.sent_whatsapp}</td>
                      <td className="py-1 text-right tabular-nums text-red-600">{b.failed}</td>
                      <td className="py-1 text-right tabular-nums text-gray-400">{b.skipped}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </SettingsSection>
        </>
      )}
    </div>
  );
}
