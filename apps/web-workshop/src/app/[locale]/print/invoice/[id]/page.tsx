'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '@/hooks/use-invoices';
import { useLabourLines, usePartsLines } from '@/hooks/use-jobs';
import { QRCodeSVG } from 'qrcode.react';
import { useTenant } from '@/hooks/use-tenant';
import { useEffect } from 'react';

export default function PrintInvoicePage() {
  const params = useParams();
  const id = params.id as string;
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: tenant } = useTenant();

  const jobCardId = invoice?.job_card_id ?? '';
  const { data: labourLines } = useLabourLines(jobCardId || '');
  const { data: partsLines } = usePartsLines(jobCardId || '');

  // Auto-trigger print dialog when data loads
  useEffect(() => {
    if (invoice && !isLoading) {
      setTimeout(() => window.print(), 500);
    }
  }, [invoice, isLoading]);

  if (isLoading || !invoice) {
    return <div className="p-8 text-center">Loading invoice...</div>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = invoice as Record<string, any>;
  const customer = (inv.customer ?? inv.customers) as { full_name: string; phone?: string; email?: string; tax_id?: string; address?: string } | undefined;
  const jobCard = (inv.job_card ?? inv.job_cards) as { job_number: string } | undefined;
  const tenantData = tenant as Record<string, unknown> | undefined;

  const formatCurrency = (val: number | string | null | undefined) => {
    const num = typeof val === 'string' ? parseFloat(val) : (val ?? 0);
    const currency = (tenantData?.currency as string) ?? 'AOA';
    try {
      return new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(num);
    } catch {
      return `${num.toFixed(2)} ${currency}`;
    }
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-PT', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const labour = (labourLines ?? []) as Array<Record<string, unknown>>;
  const parts = (partsLines ?? []) as Array<Record<string, unknown>>;

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

      {/* QR Code */}
      <div className="mt-6 flex items-center justify-between border-t pt-4">
        <div>
          <QRCodeSVG
            value={`INV:${inv.invoice_number}|NIF:${customer?.tax_id ?? ''}|DATE:${inv.created_at.slice(0, 10)}|TOTAL:${Number(inv.grand_total).toFixed(2)}|HASH:${inv.short_hash ?? ''}`}
            size={80}
          />
          <p className="text-[8px] text-gray-400 mt-1">{String(inv.short_hash ?? '')}</p>
        </div>
        <div className="text-end text-xs text-gray-400">
          <p>MECANIX Workshop Management</p>
          {inv.saft_document_number && <p className="font-mono">{String(inv.saft_document_number)}</p>}
        </div>
      </div>

      {/* Print/Close buttons - hidden on print */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button
          onClick={() => window.print()}
          className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 shadow-lg"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-lg"
        >
          Close
        </button>
      </div>

      <div className="mx-auto max-w-[210mm] bg-white p-8 font-sans text-gray-900" style={{ minHeight: '297mm' }}>
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{String(tenantData?.name ?? 'MECANIX')}</h1>
            {tenantData?.address ? <p className="mt-1 text-sm text-gray-600">{String(tenantData.address)}</p> : null}
            {tenantData?.phone ? <p className="text-sm text-gray-600">Tel: {String(tenantData.phone)}</p> : null}
            {tenantData?.email ? <p className="text-sm text-gray-600">{String(tenantData.email)}</p> : null}
            {tenantData?.tax_id ? <p className="text-sm text-gray-600">NIF: {String(tenantData.tax_id)}</p> : null}
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-700">FACTURA</h2>
            <p className="mt-2 text-lg font-semibold">{String(inv.invoice_number)}</p>
            <p className="text-sm text-gray-600">Data: {formatDate(inv.invoice_date as string)}</p>
            {inv.due_date ? <p className="text-sm text-gray-600">Vencimento: {formatDate(inv.due_date as string)}</p> : null}
            {jobCard && <p className="text-sm text-gray-600">Ref: {jobCard.job_number}</p>}
          </div>
        </div>

        {/* Customer info */}
        <div className="mb-8 rounded-md border border-gray-200 p-4">
          <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">Cliente</h3>
          <p className="font-semibold text-lg">{customer?.full_name ?? '-'}</p>
          {customer?.phone && <p className="text-sm text-gray-600">Tel: {customer.phone}</p>}
          {customer?.email && <p className="text-sm text-gray-600">{customer.email}</p>}
          {customer?.tax_id && <p className="text-sm text-gray-600">NIF: {customer.tax_id}</p>}
          {customer?.address && <p className="text-sm text-gray-600">{customer.address}</p>}
        </div>

        {/* Labour lines */}
        {labour.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold uppercase text-gray-700 mb-2 border-b border-gray-300 pb-1">Mão de Obra</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">Descrição</th>
                  <th className="py-2 pr-4 text-right">Horas</th>
                  <th className="py-2 pr-4 text-right">Taxa</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {labour.map((line, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{line.description as string}</td>
                    <td className="py-2 pr-4 text-right">{line.hours as number}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(line.rate as number)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(line.subtotal as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Parts lines */}
        {parts.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold uppercase text-gray-700 mb-2 border-b border-gray-300 pb-1">Peças</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-4">Descrição</th>
                  <th className="py-2 pr-4 text-right">Qtd</th>
                  <th className="py-2 pr-4 text-right">Preço Unit.</th>
                  <th className="py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((line, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{line.part_name as string}{line.part_number ? ` (${line.part_number})` : ''}</td>
                    <td className="py-2 pr-4 text-right">{line.quantity as number}</td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(line.sell_price as number)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(line.subtotal as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="ml-auto w-72 border-t-2 border-gray-800 pt-4">
          <div className="flex justify-between py-1 text-sm">
            <span>Mão de Obra:</span>
            <span>{formatCurrency(inv.labour_total as number)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span>Peças:</span>
            <span>{formatCurrency(inv.parts_total as number)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm border-t border-gray-200 mt-1 pt-1">
            <span>Subtotal:</span>
            <span>{formatCurrency(inv.subtotal as number)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span>IVA ({String(inv.tax_rate)}%):</span>
            <span>{formatCurrency(inv.tax_amount as number)}</span>
          </div>
          <div className="flex justify-between py-2 text-lg font-bold border-t-2 border-gray-800 mt-1">
            <span>TOTAL:</span>
            <span>{formatCurrency(inv.grand_total as number)}</span>
          </div>
          {(inv.paid_amount as number) > 0 && (
            <>
              <div className="flex justify-between py-1 text-sm text-green-700">
                <span>Pago:</span>
                <span>{formatCurrency(inv.paid_amount as number)}</span>
              </div>
              <div className="flex justify-between py-1 text-sm font-semibold text-red-700">
                <span>Saldo:</span>
                <span>{formatCurrency(inv.balance_due as number)}</span>
              </div>
            </>
          )}
        </div>

        {/* Insurance split */}
        {inv.is_insurance && (
          <div className="mt-6 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm">
            <h3 className="font-semibold text-blue-900 mb-1">Seguro</h3>
            <div className="flex justify-between">
              <span>Parte do Cliente:</span>
              <span>{formatCurrency(inv.customer_portion as number)}</span>
            </div>
            <div className="flex justify-between">
              <span>Parte da Seguradora:</span>
              <span>{formatCurrency(inv.insurance_portion as number)}</span>
            </div>
          </div>
        )}

        {/* Notes */}
        {inv.notes && (
          <div className="mt-6 text-sm text-gray-600">
            <p className="font-semibold">Notas:</p>
            <p>{String(inv.notes)}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t border-gray-300 pt-4 text-center text-xs text-gray-400">
          <p>{String(tenantData?.name ?? 'MECANIX')} — Documento gerado automaticamente</p>
        </div>
      </div>
    </>
  );
}
