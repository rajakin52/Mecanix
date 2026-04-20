'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

interface PayData {
  id: string;
  invoice_number: string;
  status: string;
  grand_total: number | string;
  balance_due: number | string;
  paid_amount: number | string;
  tax_amount: number | string;
  subtotal: number | string;
  invoice_date: string | null;
  due_date: string | null;
  customer: { full_name?: string; phone?: string; email?: string } | null;
  tenant: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    tax_id?: string;
    logo_url?: string;
    currency?: string;
  } | null;
  pay_options: {
    bankName?: string;
    bankAccount?: string;
    bankReference?: string;
    mpesaPaybill?: string;
    multicaixaNumber?: string;
    instructions?: string;
  };
}

function fmt(amount: number | string | null | undefined, currency: string | undefined) {
  const n = Number(amount ?? 0);
  try {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: currency || 'AOA',
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

export default function PublicPayPage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<PayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/public/invoices/${params.token}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(body?.error?.message ?? body?.message ?? 'Link not found or expired');
        } else {
          setData(body.data ?? body);
        }
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Link unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">{error ?? 'This payment link is no longer valid.'}</p>
          <p className="mt-4 text-xs text-gray-400">
            Please contact the workshop to get a fresh link.
          </p>
        </div>
      </div>
    );
  }

  const currency = data.tenant?.currency;
  const isPaid = data.status === 'paid' || Number(data.balance_due) <= 0;
  const opts = data.pay_options ?? {};
  const hasBank = Boolean(opts.bankName || opts.bankAccount);
  const hasMpesa = Boolean(opts.mpesaPaybill);
  const hasMulticaixa = Boolean(opts.multicaixaNumber);
  const hasAny = hasBank || hasMpesa || hasMulticaixa;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Workshop header */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {data.tenant?.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.tenant.logo_url}
                alt={data.tenant?.name ?? ''}
                className="h-12 w-12 rounded-md object-contain"
              />
            )}
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {data.tenant?.name ?? 'Workshop'}
              </h1>
              {data.tenant?.phone && (
                <p className="text-sm text-gray-500">{data.tenant.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Amount owed */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-500">
            Invoice {data.invoice_number}
          </div>
          {isPaid ? (
            <div className="mt-2">
              <div className="text-3xl font-semibold text-green-600">Paid</div>
              <p className="mt-2 text-sm text-gray-500">
                This invoice is fully settled — thank you.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {fmt(data.balance_due, currency)}
              </div>
              <p className="mt-1 text-xs text-gray-500">Balance due</p>
            </>
          )}

          <dl className="mt-4 space-y-1 text-sm text-gray-600">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{fmt(data.subtotal, currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Tax</dt>
              <dd>{fmt(data.tax_amount, currency)}</dd>
            </div>
            <div className="flex justify-between font-semibold text-gray-900">
              <dt>Grand total</dt>
              <dd>{fmt(data.grand_total, currency)}</dd>
            </div>
            {Number(data.paid_amount) > 0 && (
              <div className="flex justify-between">
                <dt>Paid</dt>
                <dd>{fmt(data.paid_amount, currency)}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Pay options */}
        {!isPaid && hasAny && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">How to pay</h2>
            <div className="space-y-3 text-sm text-gray-700">
              {hasMpesa && (
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-xs font-medium uppercase text-gray-500">M-Pesa</div>
                  <div className="mt-1 font-mono text-gray-900">{opts.mpesaPaybill}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Reference: <span className="font-mono">{data.invoice_number}</span>
                  </div>
                </div>
              )}
              {hasMulticaixa && (
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-xs font-medium uppercase text-gray-500">Multicaixa Express</div>
                  <div className="mt-1 font-mono text-gray-900">{opts.multicaixaNumber}</div>
                  <div className="mt-1 text-xs text-gray-500">
                    Reference: <span className="font-mono">{data.invoice_number}</span>
                  </div>
                </div>
              )}
              {hasBank && (
                <div className="rounded-md border border-gray-200 p-3">
                  <div className="text-xs font-medium uppercase text-gray-500">Bank transfer</div>
                  {opts.bankName && <div className="mt-1 text-gray-900">{opts.bankName}</div>}
                  {opts.bankAccount && (
                    <div className="mt-1 font-mono text-gray-900">{opts.bankAccount}</div>
                  )}
                  {opts.bankReference && (
                    <div className="mt-1 text-xs text-gray-500">
                      Reference: <span className="font-mono">{opts.bankReference}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {opts.instructions && (
              <p className="mt-4 text-xs text-gray-500">{opts.instructions}</p>
            )}
          </div>
        )}

        {!isPaid && !hasAny && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Contact the workshop directly to arrange payment — their methods aren\u2019t published yet.
          </div>
        )}

        <p className="text-center text-xs text-gray-400">
          Secure link — do not forward.
        </p>
      </div>
    </div>
  );
}
