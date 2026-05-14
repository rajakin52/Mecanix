'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useProforma } from '@/hooks/use-proformas';
import { useTenant } from '@/hooks/use-tenant';
import {
  formatCurrency as formatCurrencyLib,
  formatDate as formatDateLib,
} from '@/lib/format';

export default function PrintProformaPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: proforma, isLoading } = useProforma(id);
  const { data: tenant } = useTenant();

  // Auto-trigger the print dialog once the proforma + tenant load.
  useEffect(() => {
    if (!isLoading && proforma) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isLoading, proforma]);

  if (isLoading || !proforma) {
    return <div className="p-8 text-center">Loading proforma...</div>;
  }

  const tenantData = tenant as Record<string, unknown> | undefined;
  const customer = proforma.customer as
    | { full_name: string; phone?: string | null; email?: string | null; tax_id?: string | null; address?: string | null }
    | undefined;
  const currency = (tenantData?.currency as string) ?? 'AOA';
  const fmt = (n: number | string | null | undefined) => formatCurrencyLib(n, currency, 'pt-PT');
  const dateFmt = (d: string | null | undefined) =>
    formatDateLib(d, 'pt-PT', { year: 'numeric', month: 'long', day: 'numeric' });

  const lines = proforma.lines ?? [];

  return (
    <>
      <style jsx global>{`
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        @page {
          margin: 15mm;
          size: A4;
        }
      `}</style>

      {/* Action buttons — hidden in print */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-primary-700"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-lg hover:bg-gray-50"
        >
          Close
        </button>
      </div>

      <div
        className="mx-auto max-w-[210mm] bg-white p-6 font-sans text-[11px] leading-snug text-gray-900"
        style={{ minHeight: '297mm' }}
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between border-b-2 border-gray-800 pb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{String(tenantData?.name ?? 'MECANIX')}</h1>
            {tenantData?.address ? <p className="mt-0.5 text-[10px] text-gray-600">{String(tenantData.address)}</p> : null}
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-gray-600">
              {tenantData?.phone ? <span>Tel: {String(tenantData.phone)}</span> : null}
              {tenantData?.email ? <span>{String(tenantData.email)}</span> : null}
              {tenantData?.tax_id ? <span>NIF: {String(tenantData.tax_id)}</span> : null}
            </div>
          </div>
          <div className="text-end">
            <h2 className="text-lg font-bold text-gray-700">FACTURA PRO-FORMA</h2>
            <p className="mt-0.5 text-sm font-semibold">{proforma.proforma_number}</p>
            <p className="mt-0.5 text-[9px] text-gray-500">
              Não é um documento fiscal · Sujeito a IVA na facturação
            </p>
            <p className="mt-1 text-[10px] text-gray-600">Emitido: {dateFmt(proforma.issue_date)}</p>
            {proforma.valid_until && (
              <p className="text-[10px] font-semibold text-gray-800">Válido até: {dateFmt(proforma.valid_until)}</p>
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="mb-3 rounded-md border border-gray-200 p-2.5">
          <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gray-500">Cliente</p>
          {customer ? (
            <>
              <p className="text-sm font-semibold text-gray-900">{customer.full_name}</p>
              <div className="mt-0.5 text-[10px] text-gray-600">
                {customer.phone && <div>Tel: {customer.phone}</div>}
                {customer.email && <div>{customer.email}</div>}
                {customer.tax_id && <div>NIF: {customer.tax_id}</div>}
                {customer.address && <div>{customer.address}</div>}
              </div>
            </>
          ) : (
            <p className="text-[10px] text-gray-400">—</p>
          )}
        </div>

        {/* Lines */}
        <table className="mb-3 w-full text-[11px]">
          <thead className="border-b-2 border-gray-800">
            <tr className="text-start">
              <th className="py-1 text-start text-[9px] font-semibold uppercase tracking-wide text-gray-600">Código</th>
              <th className="py-1 text-start text-[9px] font-semibold uppercase tracking-wide text-gray-600">Descrição</th>
              <th className="py-1 text-end text-[9px] font-semibold uppercase tracking-wide text-gray-600">Qtd</th>
              <th className="py-1 text-end text-[9px] font-semibold uppercase tracking-wide text-gray-600">P. unit.</th>
              <th className="py-1 text-end text-[9px] font-semibold uppercase tracking-wide text-gray-600">IVA</th>
              <th className="py-1 text-end text-[9px] font-semibold uppercase tracking-wide text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-gray-100">
                <td className="py-1 pr-2 font-mono text-[10px]">{line.part_number ?? '—'}</td>
                <td className="py-1 pr-2">{line.part_name}</td>
                <td className="py-1 pr-2 text-end tabular-nums">{line.quantity}</td>
                <td className="py-1 pr-2 text-end tabular-nums">{fmt(line.sell_price)}</td>
                <td className="py-1 pr-2 text-end text-gray-500 tabular-nums">{Number(line.tax_rate ?? 0).toFixed(0)}%</td>
                <td className="py-1 text-end font-medium tabular-nums">{fmt(line.subtotal)}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="py-2 text-center text-gray-400">
                  Sem linhas
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals + bank details */}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          {/* Bank details — same as invoice; useful for proforma quotes too. */}
          {tenantData && (
            (tenantData['bank_name'] as string | null) ||
            (tenantData['bank_iban'] as string | null) ||
            (tenantData['bank_account_number'] as string | null) ||
            (tenantData['bank_swift'] as string | null)
          ) ? (
            <div className="max-w-xs flex-1 rounded-md border border-gray-300 bg-gray-50 p-2.5 text-[10px]">
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gray-700">
                Dados Bancários para Pagamento
              </div>
              {tenantData['bank_name'] ? (
                <div>
                  <span className="text-gray-500">Banco: </span>
                  <span className="font-medium">{String(tenantData['bank_name'])}</span>
                </div>
              ) : null}
              {tenantData['bank_account_number'] ? (
                <div>
                  <span className="text-gray-500">Conta: </span>
                  <span className="font-mono">{String(tenantData['bank_account_number'])}</span>
                </div>
              ) : null}
              {tenantData['bank_iban'] ? (
                <div>
                  <span className="text-gray-500">IBAN: </span>
                  <span className="font-mono">{String(tenantData['bank_iban'])}</span>
                </div>
              ) : null}
              {tenantData['bank_swift'] ? (
                <div>
                  <span className="text-gray-500">SWIFT/BIC: </span>
                  <span className="font-mono">{String(tenantData['bank_swift'])}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          <table className="w-72 text-[11px]">
            <tbody>
              {Number(
                (proforma as unknown as Record<string, unknown>)['total_discount'] ?? 0,
              ) > 0 && (
                <tr>
                  <td className="py-0.5 text-red-700">
                    Desconto
                    {Number((proforma as unknown as Record<string, unknown>)['discount_pct'] ?? 0) > 0 &&
                      ` (${Number((proforma as unknown as Record<string, unknown>)['discount_pct']).toFixed(1)}%)`}
                  </td>
                  <td className="py-0.5 text-end text-red-700 tabular-nums">
                    −{fmt(Number((proforma as unknown as Record<string, unknown>)['total_discount']))}
                  </td>
                </tr>
              )}
              <tr>
                <td className="py-0.5 text-gray-600">Subtotal</td>
                <td className="py-0.5 text-end tabular-nums">{fmt(proforma.subtotal)}</td>
              </tr>
              {proforma.vat_by_rate &&
                Object.entries(proforma.vat_by_rate)
                  .filter(([, amt]) => Number(amt) > 0)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([rate, amt]) => (
                    <tr key={rate}>
                      <td className="py-0.5 text-gray-600">IVA {Number(rate).toFixed(0)}%</td>
                      <td className="py-0.5 text-end tabular-nums">{fmt(Number(amt))}</td>
                    </tr>
                  ))}
              {(!proforma.vat_by_rate ||
                Object.keys(proforma.vat_by_rate).length === 0) && (
                <tr>
                  <td className="py-0.5 text-gray-600">IVA</td>
                  <td className="py-0.5 text-end tabular-nums">{fmt(proforma.tax_amount)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-800">
                <td className="pt-1 text-sm font-bold">Total</td>
                <td className="pt-1 text-end text-sm font-bold tabular-nums">{fmt(proforma.grand_total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {proforma.notes && (
          <div className="mb-4 border-t pt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Notas
            </p>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{proforma.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t pt-4 text-center text-xs text-gray-500">
          Documento não fiscal · Esta pro-forma não substitui a factura · Valores podem ser ajustados na facturação final
        </div>
      </div>
    </>
  );
}
