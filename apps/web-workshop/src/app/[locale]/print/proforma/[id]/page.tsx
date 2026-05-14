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
        className="mx-auto max-w-[210mm] bg-white p-8 font-sans text-gray-900"
        style={{ minHeight: '297mm' }}
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between border-b-2 border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{String(tenantData?.name ?? 'MECANIX')}</h1>
            {tenantData?.address ? <p className="mt-1 text-sm text-gray-600">{String(tenantData.address)}</p> : null}
            {tenantData?.phone ? <p className="text-sm text-gray-600">Tel: {String(tenantData.phone)}</p> : null}
            {tenantData?.email ? <p className="text-sm text-gray-600">{String(tenantData.email)}</p> : null}
            {tenantData?.tax_id ? <p className="text-sm text-gray-600">NIF: {String(tenantData.tax_id)}</p> : null}
          </div>
          <div className="text-end">
            <h2 className="text-2xl font-bold text-gray-700">FACTURA PRO-FORMA</h2>
            <p className="mt-2 text-lg font-semibold">{proforma.proforma_number}</p>
            <p className="mt-1 text-xs text-gray-500">
              Não é um documento fiscal · Sujeito a IVA na facturação
            </p>
            <p className="mt-3 text-sm text-gray-600">Emitido: {dateFmt(proforma.issue_date)}</p>
            {proforma.valid_until && (
              <p className="text-sm text-gray-600">Válido até: {dateFmt(proforma.valid_until)}</p>
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="mb-6 grid grid-cols-2 gap-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</p>
            {customer ? (
              <>
                <p className="text-sm font-semibold text-gray-900">{customer.full_name}</p>
                {customer.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
                {customer.email && <p className="text-sm text-gray-600">{customer.email}</p>}
                {customer.tax_id && <p className="text-sm text-gray-600">NIF: {customer.tax_id}</p>}
                {customer.address && <p className="text-sm text-gray-600">{customer.address}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>
        </div>

        {/* Lines */}
        <table className="mb-6 w-full text-sm">
          <thead className="border-b-2 border-gray-800">
            <tr className="text-start">
              <th className="py-2 text-start text-xs font-semibold uppercase text-gray-600">Código</th>
              <th className="py-2 text-start text-xs font-semibold uppercase text-gray-600">Descrição</th>
              <th className="py-2 text-end text-xs font-semibold uppercase text-gray-600">Qtd</th>
              <th className="py-2 text-end text-xs font-semibold uppercase text-gray-600">P. unit.</th>
              <th className="py-2 text-end text-xs font-semibold uppercase text-gray-600">IVA</th>
              <th className="py-2 text-end text-xs font-semibold uppercase text-gray-600">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} className="border-b border-gray-100">
                <td className="py-1.5 font-mono text-xs">{line.part_number ?? '—'}</td>
                <td className="py-1.5">{line.part_name}</td>
                <td className="py-1.5 text-end">{line.quantity}</td>
                <td className="py-1.5 text-end">{fmt(line.sell_price)}</td>
                <td className="py-1.5 text-end text-gray-500">{Number(line.tax_rate ?? 0).toFixed(0)}%</td>
                <td className="py-1.5 text-end font-medium">{fmt(line.subtotal)}</td>
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-center text-gray-400">
                  Sem linhas
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mb-6 flex justify-end">
          <table className="w-72 text-sm">
            <tbody>
              <tr>
                <td className="py-1 text-gray-600">Subtotal</td>
                <td className="py-1 text-end">{fmt(proforma.subtotal)}</td>
              </tr>
              {proforma.vat_by_rate &&
                Object.entries(proforma.vat_by_rate)
                  .filter(([, amt]) => Number(amt) > 0)
                  .sort(([a], [b]) => Number(b) - Number(a))
                  .map(([rate, amt]) => (
                    <tr key={rate}>
                      <td className="py-1 text-gray-600">IVA {Number(rate).toFixed(0)}%</td>
                      <td className="py-1 text-end">{fmt(Number(amt))}</td>
                    </tr>
                  ))}
              {(!proforma.vat_by_rate ||
                Object.keys(proforma.vat_by_rate).length === 0) && (
                <tr>
                  <td className="py-1 text-gray-600">IVA</td>
                  <td className="py-1 text-end">{fmt(proforma.tax_amount)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-800">
                <td className="pt-2 text-base font-bold">Total</td>
                <td className="pt-2 text-end text-base font-bold">{fmt(proforma.grand_total)}</td>
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
