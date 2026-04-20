'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useInvoices, useSendPaymentReminder, useCreatePaymentLink } from '@/hooks/use-invoices';
import { formatCurrency, formatDate } from '@/lib/format';
import { SkeletonTable, useToast } from '@mecanix/ui-web';

// Ladder stages mirror the cron — 3 / 7 / 14 / 30 days overdue.
const LADDER: Array<{ at: number; label: string; step: number }> = [
  { at: 3, label: 'Nudge', step: 1 },
  { at: 7, label: 'First reminder', step: 2 },
  { at: 14, label: 'Firm reminder', step: 3 },
  { at: 30, label: 'Final notice', step: 4 },
];

function currentStage(daysOverdue: number) {
  let stage = LADDER[0]!;
  for (const s of LADDER) if (daysOverdue >= s.at) stage = s;
  return stage;
}

interface Row {
  id: string;
  invoice_number: string;
  customer: string;
  phone: string | null;
  balance: number;
  grand_total: number;
  due_date: string | null;
  days_overdue: number;
  reminder_count: number;
  last_reminder_sent_at: string | null;
  status: string;
  public_pay_token: string | null;
  bucket: 'current' | '30' | '60' | '90+';
}

export default function CollectionsPage() {
  const toast = useToast();
  const [page] = useState(1);
  // Fetch sent + partial in one page (collections is rarely more than 100 rows)
  const { data: sent, isLoading: lSent } = useInvoices(page, 'sent');
  const { data: partial, isLoading: lPartial } = useInvoices(page, 'partial');
  const { data: overdue, isLoading: lOver } = useInvoices(page, 'overdue');
  const sendReminder = useSendPaymentReminder();
  const createLink = useCreatePaymentLink();

  const rows: Row[] = useMemo(() => {
    const now = Date.now();
    const combine = (r: { data?: Array<Record<string, unknown>> } | undefined) =>
      (r?.data ?? []) as Array<Record<string, unknown>>;
    const all: Array<Record<string, unknown>> = [
      ...combine(sent as unknown as { data?: Array<Record<string, unknown>> }),
      ...combine(partial as unknown as { data?: Array<Record<string, unknown>> }),
      ...combine(overdue as unknown as { data?: Array<Record<string, unknown>> }),
    ];
    const byId = new Map<string, Record<string, unknown>>();
    for (const inv of all) byId.set(inv.id as string, inv);

    return Array.from(byId.values())
      .filter((inv) => Number(inv.balance_due) > 0)
      .map<Row>((inv) => {
        const due = inv.due_date ? new Date(inv.due_date as string).getTime() : null;
        const daysOverdue = due ? Math.floor((now - due) / (1000 * 60 * 60 * 24)) : 0;
        const bucket: Row['bucket'] =
          daysOverdue <= 0 ? 'current' : daysOverdue <= 30 ? '30' : daysOverdue <= 60 ? '60' : '90+';
        const cust = (inv.customer ?? inv.customers) as Record<string, unknown> | null;
        return {
          id: inv.id as string,
          invoice_number: inv.invoice_number as string,
          customer: (cust?.full_name as string | undefined) ?? '—',
          phone: (cust?.phone as string | undefined) ?? null,
          balance: Number(inv.balance_due) || 0,
          grand_total: Number(inv.grand_total) || 0,
          due_date: (inv.due_date as string | null) ?? null,
          days_overdue: Math.max(0, daysOverdue),
          reminder_count: Number(inv.payment_reminder_count ?? 0),
          last_reminder_sent_at: (inv.last_reminder_sent_at as string | null) ?? null,
          status: inv.status as string,
          public_pay_token: (inv.public_pay_token as string | null) ?? null,
          bucket,
        };
      })
      .sort((a, b) => b.days_overdue - a.days_overdue);
  }, [sent, partial, overdue]);

  const totals = useMemo(() => {
    const buckets: Record<string, number> = { current: 0, '30': 0, '60': 0, '90+': 0 };
    let totalBalance = 0;
    let totalOverdue = 0;
    for (const r of rows) {
      buckets[r.bucket] = (buckets[r.bucket] ?? 0) + r.balance;
      totalBalance += r.balance;
      if (r.days_overdue > 0) totalOverdue += r.balance;
    }
    return { buckets, totalBalance, totalOverdue };
  }, [rows]);

  const isLoading = lSent || lPartial || lOver;

  const copyPayLink = async (row: Row) => {
    try {
      let token = row.public_pay_token;
      if (!token) {
        const res = await createLink.mutateAsync(row.id);
        token = (res as { public_pay_token?: string } | undefined)?.public_pay_token ?? null;
      }
      if (!token) throw new Error('No token');
      const url = `${window.location.origin}/${window.location.pathname.split('/')[1]}/public/pay/${token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Payment link copied');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleSendReminder = async (row: Row) => {
    try {
      const res = await sendReminder.mutateAsync(row.id);
      const ok = (res as { ok?: boolean } | undefined)?.ok;
      const reason = (res as { reason?: string } | undefined)?.reason;
      if (ok) {
        toast.success('Reminder sent');
      } else {
        toast.error(`Could not send: ${reason ?? 'unknown'}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Collections</h1>
        <p className="mt-1 text-sm text-gray-600">
          Dunning ladder: day 3 nudge → day 7 reminder → day 14 firm reminder → day 30 final
          notice. Cron handles the schedule; this page lets you act out-of-band.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
        <Kpi label="Outstanding" value={formatCurrency(totals.totalBalance)} />
        <Kpi label="Overdue" value={formatCurrency(totals.totalOverdue)} color="text-red-600" />
        <Kpi label="1–30 days" value={formatCurrency(totals.buckets['30'] ?? 0)} color="text-yellow-600" />
        <Kpi label="31–60 days" value={formatCurrency(totals.buckets['60'] ?? 0)} color="text-orange-600" />
        <Kpi label="60+ days" value={formatCurrency(totals.buckets['90+'] ?? 0)} color="text-red-600" />
      </div>

      {isLoading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          Nothing outstanding — every invoice is settled.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase text-gray-500">Invoice</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase text-gray-500">Customer</th>
                <th className="px-3 py-3 text-end text-xs font-semibold uppercase text-gray-500">Balance</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase text-gray-500">Due</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase text-gray-500">Ladder stage</th>
                <th className="px-3 py-3 text-start text-xs font-semibold uppercase text-gray-500">Reminders</th>
                <th className="px-3 py-3 text-end text-xs font-semibold uppercase text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {rows.map((r) => {
                const stage = r.days_overdue > 0 ? currentStage(r.days_overdue) : null;
                const bucketColor =
                  r.bucket === 'current'
                    ? 'bg-gray-100 text-gray-700'
                    : r.bucket === '30'
                    ? 'bg-yellow-100 text-yellow-800'
                    : r.bucket === '60'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-red-100 text-red-800';
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm">
                      <Link href={`/invoices/${r.id}`} className="font-medium text-primary-600 hover:underline">
                        {r.invoice_number}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-900">{r.customer}</div>
                      <div className="text-xs text-gray-500">{r.phone ?? 'no phone on file'}</div>
                    </td>
                    <td className="px-3 py-3 text-end text-sm">
                      <span className="font-medium text-gray-900">{formatCurrency(r.balance)}</span>
                      <div className="text-xs text-gray-400">
                        of {formatCurrency(r.grand_total)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {r.due_date ? formatDate(r.due_date) : '—'}
                      {r.days_overdue > 0 && (
                        <div className="text-xs text-red-600">{r.days_overdue} days overdue</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${bucketColor}`}>
                        {stage ? stage.label : 'Current'}
                      </span>
                      {stage ? (
                        <div className="mt-0.5 text-xs text-gray-500">Step {stage.step} / 4</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {r.reminder_count} sent
                      {r.last_reminder_sent_at ? (
                        <div className="text-xs text-gray-500">
                          last: {formatDate(r.last_reminder_sent_at)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-end">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleSendReminder(r)}
                          disabled={sendReminder.isPending || !r.phone}
                          className="rounded-md border border-primary-300 px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 disabled:opacity-40"
                        >
                          Send reminder
                        </button>
                        <button
                          onClick={() => copyPayLink(r)}
                          disabled={createLink.isPending}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                        >
                          Copy pay link
                        </button>
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
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${color ?? 'text-gray-900'}`}>{value}</div>
    </div>
  );
}
