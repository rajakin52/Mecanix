'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '@/hooks/use-invoices';
import { useLabourLines, usePartsLines } from '@/hooks/use-jobs';
import { useVehicle } from '@/hooks/use-vehicles';
import { useReception } from '@/hooks/use-receptions';
import { QRCodeSVG } from 'qrcode.react';
import { useTenant } from '@/hooks/use-tenant';
import { useEffect } from 'react';
import { formatCurrency as formatCurrencyLib, formatDate as formatDateLib } from '@/lib/format';

const FUEL_LEVEL_LABELS: Record<string, string> = {
  empty: 'Vazio',
  quarter: '1/4',
  half: '1/2',
  three_quarter: '3/4',
  full: 'Cheio',
};

export default function PrintInvoicePage() {
  const params = useParams();
  const id = params.id as string;
  const { data: invoice, isLoading } = useInvoice(id);
  const { data: tenant } = useTenant();

  const jobCardId = invoice?.job_card_id ?? '';
  const isStandalone = !jobCardId;
  const { data: labourLines, isLoading: labourLoading } = useLabourLines(jobCardId || '');
  const { data: jobPartsLines, isLoading: partsLoading } = usePartsLines(jobCardId || '');
  // For OTC sales, parts_lines come embedded on the invoice (invoice_id path)
  const standaloneParts = isStandalone
    ? (((invoice as unknown as { standalone_parts_lines?: Array<Record<string, unknown>> })?.standalone_parts_lines) ?? [])
    : [];
  const partsLines = isStandalone ? standaloneParts : jobPartsLines;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const invForVehicle = invoice as Record<string, any> | undefined;
  const vehicleId =
    (invForVehicle?.job_card?.vehicle_id as string | undefined) ??
    (invForVehicle?.job_cards?.vehicle_id as string | undefined) ??
    '';
  const { data: vehicle, isLoading: vehicleLoading } = useVehicle(vehicleId);
  const { data: reception, isLoading: receptionLoading } = useReception(jobCardId || '');

  // Auto-trigger print dialog only once all dependent queries have resolved,
  // otherwise parts/labour/vehicle sections would be missing from the print.
  const allLoaded =
    !isLoading &&
    !!invoice &&
    (!jobCardId || (!labourLoading && !partsLoading && !receptionLoading)) &&
    (!vehicleId || !vehicleLoading);

  useEffect(() => {
    if (allLoaded) {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [allLoaded]);

  if (isLoading || !invoice) {
    return <div className="p-8 text-center">Loading invoice...</div>;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inv = invoice as Record<string, any>;
  const customer = (inv.customer ?? inv.customers) as { full_name: string; phone?: string; email?: string; tax_id?: string; address?: string; is_corporate?: boolean; company_name?: string } | undefined;
  const jobCard = (inv.job_card ?? inv.job_cards) as {
    job_number: string;
    reported_problem?: string | null;
    customer_remarks?: string | null;
    internal_notes?: string | null;
    date_opened?: string | null;
    date_closed?: string | null;
    service_writer?: { id: string; full_name: string } | null;
    primary_technician?: { id: string; full_name: string } | null;
    vehicle?: { plate?: string; vin?: string | null; make?: string; model?: string; year?: number | null; color?: string | null; fuel_type?: string | null; mileage?: number | null } | null;
  } | undefined;
  const tenantData = tenant as Record<string, unknown> | undefined;
  // Prefer the JC-joined vehicle (richer — includes VIN); fall back to the
  // separately-fetched vehicle hook for invoices that don't carry the join.
  const veh = (jobCard?.vehicle ?? vehicle) as {
    plate?: string;
    vin?: string | null;
    make?: string;
    model?: string;
    year?: number | null;
    color?: string | null;
    fuel_type?: string | null;
    mileage?: number | null;
  } | undefined;
  const rec = reception as { odometer_km?: number; fuel_level?: string } | null | undefined;
  const odometer = rec?.odometer_km ?? veh?.mileage ?? null;
  const serviceAdvisor = jobCard?.service_writer?.full_name ?? null;
  const technician = jobCard?.primary_technician?.full_name ?? null;
  const fuelLevelLabel = rec?.fuel_level ? FUEL_LEVEL_LABELS[rec.fuel_level] ?? rec.fuel_level : null;
  const isCorporate = !!customer?.is_corporate;

  const currency = (tenantData?.currency as string) ?? 'AOA';
  const formatCurrency = (val: number | string | null | undefined) => formatCurrencyLib(val, currency, 'pt-PT');
  const formatDate = (d: string | null | undefined) => formatDateLib(d, 'pt-PT', { year: 'numeric', month: 'long', day: 'numeric' });

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

      <div className="mx-auto max-w-[210mm] bg-white p-6 font-sans text-[11px] leading-snug text-gray-900" style={{ minHeight: '297mm' }}>
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-gray-800 pb-3 mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{String(tenantData?.name ?? 'MECANIX')}</h1>
            {tenantData?.address ? <p className="mt-0.5 text-[10px] text-gray-600">{String(tenantData.address)}</p> : null}
            <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-gray-600">
              {tenantData?.phone ? <span>Tel: {String(tenantData.phone)}</span> : null}
              {tenantData?.email ? <span>{String(tenantData.email)}</span> : null}
              {tenantData?.tax_id ? <span>NIF: {String(tenantData.tax_id)}</span> : null}
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-gray-700">FACTURA</h2>
            <p className="mt-0.5 text-sm font-semibold">{String(inv.invoice_number)}</p>
            <p className="text-[10px] text-gray-600">Data: {formatDate(inv.invoice_date as string)}</p>
            {inv.due_date ? (
              <p className="text-[10px] font-semibold text-gray-800">
                Vencimento: {formatDate(inv.due_date as string)}
              </p>
            ) : null}
            {jobCard && <p className="text-[10px] text-gray-600">Ref: {jobCard.job_number}</p>}
          </div>
        </div>

        {/* Customer + Vehicle side-by-side for compactness */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-gray-200 p-2.5">
            <h3 className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Cliente</h3>
            <p className="text-sm font-semibold">
              {isCorporate && customer?.company_name ? customer.company_name : customer?.full_name ?? '-'}
            </p>
            <div className="mt-0.5 text-[10px] text-gray-600">
              {customer?.phone && <div>Tel: {customer.phone}</div>}
              {customer?.email && <div>{customer.email}</div>}
              {isCorporate && customer?.tax_id && <div>NIF: {customer.tax_id}</div>}
              {customer?.address && <div>{customer.address}</div>}
            </div>
          </div>
          {veh && (
            <div className="rounded-md border border-gray-200 p-2.5">
              <h3 className="text-[9px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Viatura</h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-700">
                {veh.plate && (
                  <p>
                    <span className="text-gray-500">Matrícula:</span>{' '}
                    <span className="font-semibold">{veh.plate}</span>
                  </p>
                )}
                {(veh.make || veh.model) && (
                  <p>
                    <span className="text-gray-500">Marca/Modelo:</span>{' '}
                    <span className="font-semibold">
                      {[veh.make, veh.model].filter(Boolean).join(' ')}
                      {veh.year ? ` (${veh.year})` : ''}
                    </span>
                  </p>
                )}
                {veh.vin && (
                  <p className="col-span-2">
                    <span className="text-gray-500">VIN / Chassi:</span>{' '}
                    <span className="font-mono font-semibold">{veh.vin}</span>
                  </p>
                )}
                {odometer != null && (
                  <p>
                    <span className="text-gray-500">Km:</span>{' '}
                    <span className="font-semibold">{odometer.toLocaleString('pt-PT')}</span>
                  </p>
                )}
                {fuelLevelLabel && (
                  <p>
                    <span className="text-gray-500">Combustível:</span>{' '}
                    <span className="font-semibold">{fuelLevelLabel}</span>
                  </p>
                )}
                {veh.color && (
                  <p>
                    <span className="text-gray-500">Cor:</span>{' '}
                    <span className="font-semibold">{veh.color}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Job Summary — only for JC-linked (repair) invoices. */}
        {jobCard && (
          <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 p-2.5">
            <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gray-500">
              Resumo do Serviço
            </h3>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-700">
              <p>
                <span className="text-gray-500">Job card:</span>{' '}
                <span className="font-semibold">{jobCard.job_number}</span>
              </p>
              {jobCard.date_opened && (
                <p>
                  <span className="text-gray-500">Aberto:</span>{' '}
                  <span className="font-semibold">{formatDate(jobCard.date_opened)}</span>
                </p>
              )}
              {jobCard.date_closed && (
                <p>
                  <span className="text-gray-500">Concluído:</span>{' '}
                  <span className="font-semibold">{formatDate(jobCard.date_closed)}</span>
                </p>
              )}
              {serviceAdvisor && (
                <p>
                  <span className="text-gray-500">Recepcionista:</span>{' '}
                  <span className="font-semibold">{serviceAdvisor}</span>
                </p>
              )}
              {technician && (
                <p>
                  <span className="text-gray-500">Técnico:</span>{' '}
                  <span className="font-semibold">{technician}</span>
                </p>
              )}
            </div>
            {jobCard.reported_problem && (
              <p className="mt-1.5 text-[10px] text-gray-700">
                <span className="text-gray-500">Problema reportado: </span>
                <span>{jobCard.reported_problem}</span>
              </p>
            )}
          </div>
        )}

        {/* Parts lines — first per the workshop convention. */}
        {parts.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-1 border-b border-gray-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">Peças</h3>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-wide text-gray-500">
                  <th className="py-1 pr-2">Código</th>
                  <th className="py-1 pr-2">Descrição</th>
                  <th className="py-1 pr-2 text-right">Qtd</th>
                  <th className="py-1 pr-2 text-right">P. unit.</th>
                  <th className="py-1 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((line, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 pr-2 font-mono text-[10px]">{(line.part_number as string) ?? '—'}</td>
                    <td className="py-1 pr-2">{line.part_name as string}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{line.quantity as number}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{formatCurrency(line.sell_price as number)}</td>
                    <td className="py-1 text-right font-medium tabular-nums">{formatCurrency(line.subtotal as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Labour lines — only on JC-linked (repair) invoices. */}
        {!isStandalone && labour.length > 0 && (
          <div className="mb-3">
            <h3 className="mb-1 border-b border-gray-300 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">Mão de Obra</h3>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-wide text-gray-500">
                  <th className="py-1 pr-3">Descrição</th>
                  <th className="py-1 pr-3 text-right">Horas</th>
                  <th className="py-1 pr-3 text-right">Taxa</th>
                  <th className="py-1 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {labour.map((line, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-1 pr-3">{line.description as string}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{line.hours as number}</td>
                    <td className="py-1 pr-3 text-right tabular-nums">{formatCurrency(line.rate as number)}</td>
                    <td className="py-1 text-right font-medium tabular-nums">{formatCurrency(line.subtotal as number)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals + bank details */}
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          {/* Bank details — only shown when at least one field is set */}
          {tenant && (tenant.bank_name || tenant.bank_iban || tenant.bank_account_number || tenant.bank_swift) && (
            <div className="max-w-xs flex-1 rounded-md border border-gray-300 bg-gray-50 p-2.5 text-[10px]">
              <div className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gray-700">
                Dados Bancários para Pagamento
              </div>
              {tenant.bank_name && (
                <div>
                  <span className="text-gray-500">Banco: </span>
                  <span className="font-medium">{tenant.bank_name}</span>
                </div>
              )}
              {tenant.bank_account_number && (
                <div>
                  <span className="text-gray-500">Conta: </span>
                  <span className="font-mono">{tenant.bank_account_number}</span>
                </div>
              )}
              {tenant.bank_iban && (
                <div>
                  <span className="text-gray-500">IBAN: </span>
                  <span className="font-mono">{tenant.bank_iban}</span>
                </div>
              )}
              {tenant.bank_swift && (
                <div>
                  <span className="text-gray-500">SWIFT/BIC: </span>
                  <span className="font-mono">{tenant.bank_swift}</span>
                </div>
              )}
            </div>
          )}

          {/* Totals (right) */}
          <div className="w-72 border-t-2 border-gray-800 pt-2">
          {!isStandalone && (
            <div className="flex justify-between py-0.5 text-[11px]">
              <span>Mão de Obra:</span>
              <span className="tabular-nums">{formatCurrency(inv.labour_total as number)}</span>
            </div>
          )}
          <div className="flex justify-between py-0.5 text-[11px]">
            <span>Peças:</span>
            <span className="tabular-nums">{formatCurrency(inv.parts_total as number)}</span>
          </div>
          {((inv.total_discount as number) ?? 0) > 0 && (
            <div className="flex justify-between py-0.5 text-[11px] text-red-700">
              <span>
                Desconto
                {Number(inv.discount_pct ?? 0) > 0 && ` (${Number(inv.discount_pct).toFixed(1)}%)`}
              </span>
              <span className="tabular-nums">−{formatCurrency(inv.total_discount as number)}</span>
            </div>
          )}
          <div className="mt-0.5 flex justify-between border-t border-gray-200 pt-0.5 text-[11px]">
            <span>Subtotal:</span>
            <span className="tabular-nums">{formatCurrency(inv.subtotal as number)}</span>
          </div>

          {/* Per-rate VAT breakdown (falls back to single-rate for old invoices) */}
          {inv.vat_by_rate && Object.keys(inv.vat_by_rate as Record<string, number>).length > 0 ? (
            Object.entries(inv.vat_by_rate as Record<string, number>)
              .filter(([, amt]) => (amt as number) > 0)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([rate, amt]) => (
                <div key={rate} className="flex justify-between py-0.5 text-[11px]">
                  <span>IVA {Number(rate).toFixed(0)}%:</span>
                  <span className="tabular-nums">{formatCurrency(amt as number)}</span>
                </div>
              ))
          ) : (
            <div className="flex justify-between py-0.5 text-[11px]">
              <span>IVA ({String(inv.tax_rate)}%):</span>
              <span className="tabular-nums">{formatCurrency(inv.tax_amount as number)}</span>
            </div>
          )}

          <div className="mt-0.5 flex justify-between border-t border-gray-200 pt-0.5 text-[11px] font-medium">
            <span>Total (c/ IVA):</span>
            <span className="tabular-nums">{formatCurrency(inv.grand_total as number)}</span>
          </div>

          {/* Captive VAT deduction */}
          {(inv.iva_captive_amount as number) > 0 && (
            <div className="flex justify-between py-0.5 text-[11px] text-amber-700">
              <span>IVA Cativo ({String(inv.vat_captive_pct)}%):</span>
              <span className="tabular-nums">−{formatCurrency(inv.iva_captive_amount as number)}</span>
            </div>
          )}

          {/* Service retention deduction */}
          {(inv.service_retention_amount as number) > 0 && (
            <div className="flex justify-between py-0.5 text-[11px] text-amber-700">
              <span>Retenção serviços ({Number(inv.service_retention_pct).toFixed(1)}%):</span>
              <span className="tabular-nums">−{formatCurrency(inv.service_retention_amount as number)}</span>
            </div>
          )}

          {(() => {
            const aPagar =
              (inv.grand_total as number)
              - ((inv.iva_captive_amount as number) ?? 0)
              - ((inv.service_retention_amount as number) ?? 0);
            const paid = (inv.paid_amount as number) ?? 0;
            const saldo = (inv.balance_due as number) ?? (aPagar - paid);
            return (
              <>
                <div className="mt-1 flex justify-between border-t-2 border-gray-800 py-1 text-sm font-bold">
                  <span>A PAGAR:</span>
                  <span className="tabular-nums">{formatCurrency(aPagar)}</span>
                </div>
                {paid > 0 && (
                  <>
                    <div className="flex justify-between py-0.5 text-[11px] text-green-700">
                      <span>Pago:</span>
                      <span className="tabular-nums">{formatCurrency(paid)}</span>
                    </div>
                    <div className="flex justify-between py-0.5 text-sm font-semibold text-red-700">
                      <span>Saldo:</span>
                      <span className="tabular-nums">{formatCurrency(saldo)}</span>
                    </div>
                  </>
                )}
                {inv.due_date ? (
                  <div className="mt-1 text-[10px] text-gray-600">
                    Vencimento: <span className="font-semibold text-gray-800">{formatDate(inv.due_date as string)}</span>
                  </div>
                ) : null}
              </>
            );
          })()}
          </div>
        </div>

        {/* Legal note when captive or retention applies */}
        {((inv.iva_captive_amount as number) > 0 || (inv.service_retention_amount as number) > 0) && (
          <div className="mt-4 ms-auto w-[60%] text-[10px] text-gray-500 italic">
            {(inv.iva_captive_amount as number) > 0 && (
              <p>IVA cativado pelo adquirente nos termos do Código do IVA (Lei n.º 7/19).</p>
            )}
            {(inv.service_retention_amount as number) > 0 && (
              <p>Retenção na fonte a 6,5% sobre serviços ao abrigo do Código do Imposto Industrial.</p>
            )}
          </div>
        )}

        {/* Insurance split */}
        {inv.is_insurance && (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2.5 text-[10px]">
            <h3 className="mb-0.5 font-semibold text-blue-900">Seguro</h3>
            <div className="flex justify-between">
              <span>Parte do Cliente:</span>
              <span className="tabular-nums">{formatCurrency(inv.customer_portion as number)}</span>
            </div>
            <div className="flex justify-between">
              <span>Parte da Seguradora:</span>
              <span className="tabular-nums">{formatCurrency(inv.insurance_portion as number)}</span>
            </div>
          </div>
        )}

        {/* Warranty / Notes — bundles workshop boilerplate + per-line warranty
            from the JC labour (warranty_months / warranty_km on each line)
            + any free-text notes captured at invoice generation. */}
        {(() => {
          const linesWithWarranty = labour.filter(
            (l) => (l.warranty_months as number | null) || (l.warranty_km as number | null),
          );
          const hasWarrantyContent = linesWithWarranty.length > 0;
          const hasNotes = !!inv.notes;
          const hasJcRemarks = !!jobCard?.customer_remarks;
          if (!hasWarrantyContent && !hasNotes && !hasJcRemarks && isStandalone) return null;
          return (
            <div className="mt-3 rounded-md border border-gray-200 p-2.5">
              <h3 className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                Garantia &amp; Notas
              </h3>
              {!isStandalone && (
                <p className="text-[10px] text-gray-700">
                  Mão de obra e peças fornecidas estão cobertas por garantia conforme indicada
                  por linha abaixo. Não cobre desgaste normal, uso indevido, ou intervenções
                  realizadas por terceiros após a entrega do veículo.
                </p>
              )}
              {hasWarrantyContent && (
                <ul className="mt-1 list-disc ps-4 text-[10px] text-gray-700">
                  {linesWithWarranty.map((l, i) => {
                    const m = l.warranty_months as number | null;
                    const km = l.warranty_km as number | null;
                    const parts: string[] = [];
                    if (m != null) parts.push(`${m} meses`);
                    if (km != null) parts.push(`${(km / 1000).toFixed(0)}k km`);
                    return (
                      <li key={i}>
                        <span className="font-medium">{l.description as string}:</span>{' '}
                        {parts.join(' / ')}
                      </li>
                    );
                  })}
                </ul>
              )}
              {hasJcRemarks && (
                <div className="mt-1 text-[10px] text-gray-700">
                  <span className="text-gray-500">Observações do cliente: </span>
                  <span>{String(jobCard?.customer_remarks)}</span>
                </div>
              )}
              {hasNotes && (
                <div className="mt-1 text-[10px] text-gray-700">
                  <span className="text-gray-500">Notas: </span>
                  <span>{String(inv.notes)}</span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Next service recommendation — only when the JC has a next-due
            captured on customer_remarks / internal_notes or on a separate
            field. For now we surface internal_notes-as-recommendation only
            when prefixed with "Próxima revisão:" so non-recommendation
            notes don't leak. */}
        {jobCard?.internal_notes && /pr[óo]xim[ao]\s+(revis[ãa]o|servi[çc]o|manuten[çc][ãa]o)/i.test(jobCard.internal_notes) && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2.5">
            <h3 className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700">
              Próximo Serviço Recomendado
            </h3>
            <p className="text-[10px] text-gray-700">{jobCard.internal_notes}</p>
          </div>
        )}

        {/* Signature — workshop + customer. Print-only feature; reproduces
            the legal acknowledgement the customer signs on collection. */}
        {!isStandalone && (
          <div className="mt-6 grid grid-cols-2 gap-8">
            <div>
              <div className="mb-1 h-12 border-b border-gray-400"></div>
              <p className="text-[9px] uppercase tracking-wide text-gray-500">
                Oficina · {String(tenantData?.name ?? '')}
              </p>
            </div>
            <div>
              <div className="mb-1 h-12 border-b border-gray-400"></div>
              <p className="text-[9px] uppercase tracking-wide text-gray-500">
                Cliente · {customer?.full_name ?? ''}
              </p>
              <p className="text-[9px] text-gray-400">
                Declaro ter recebido o veículo e os serviços identificados nesta factura.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 border-t border-gray-300 pt-2 text-center text-[9px] text-gray-400">
          <p>{String(tenantData?.name ?? 'MECANIX')} — Documento gerado automaticamente</p>
        </div>
      </div>
    </>
  );
}
