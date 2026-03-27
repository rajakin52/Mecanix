'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface EstimateData {
  id: string;
  estimate_number: string;
  version: number;
  status: string;
  labour_total: number;
  parts_total: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  labour_lines_snapshot: Array<Record<string, unknown>>;
  parts_lines_snapshot: Array<Record<string, unknown>>;
  valid_until: string | null;
  change_summary: string | null;
  is_revision: boolean;
  created_at: string;
  job_card_id: string;
}

export default function PrintEstimatePage() {
  const params = useParams();
  const id = params.id as string;
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [tenant, setTenant] = useState<Record<string, unknown> | null>(null);
  const [job, setJob] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<EstimateData>(`/estimates/${id}`),
      api.get<Record<string, unknown>>('/tenants/me'),
    ]).then(async ([est, ten]) => {
      setEstimate(est);
      setTenant(ten);
      const jobData = await api.get<Record<string, unknown>>(`/jobs/${est.job_card_id}`);
      setJob(jobData);
      setLoading(false);
      setTimeout(() => window.print(), 500);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading || !estimate || !tenant) {
    return <p className="p-8 text-gray-500">Loading...</p>;
  }

  const vehicle = (job?.vehicle ?? job?.vehicles) as Record<string, string> | undefined;
  const customer = (job?.customer ?? job?.customers) as Record<string, string> | undefined;
  const fmt = (n: number) => n.toFixed(2);

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-8 text-sm print:p-6">
      <style>{`@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      {/* Watermark */}
      <div className="text-center mb-1">
        <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">Quotation — This is not an invoice</span>
      </div>

      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">{tenant.name as string}</h1>
          {tenant.address && <p className="text-gray-600 mt-1">{tenant.address as string}</p>}
          {tenant.phone && <p className="text-gray-600">Tel: {tenant.phone as string}</p>}
          {tenant.email && <p className="text-gray-600">{tenant.email as string}</p>}
          {tenant.tax_id && <p className="text-gray-600">NIF: {tenant.tax_id as string}</p>}
        </div>
        <div className="text-end">
          <p className="text-2xl font-black text-gray-900">{estimate.estimate_number}</p>
          <p className="text-gray-500 mt-1">Version {estimate.version}</p>
          <p className="text-gray-500">{new Date(estimate.created_at).toLocaleDateString()}</p>
          {estimate.valid_until && (
            <p className="text-orange-600 font-semibold mt-1">Valid until: {new Date(estimate.valid_until).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      {/* Customer + Vehicle */}
      <div className="grid grid-cols-2 gap-8 mb-6">
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Customer</h3>
          <p className="font-semibold text-gray-900">{customer?.full_name ?? '-'}</p>
          {customer?.phone && <p className="text-gray-600">{customer.phone}</p>}
          {customer?.email && <p className="text-gray-600">{customer.email}</p>}
        </div>
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-1">Vehicle</h3>
          <p className="font-semibold text-gray-900">{vehicle?.plate ?? '-'}</p>
          <p className="text-gray-600">{vehicle?.make} {vehicle?.model} {vehicle?.year ? `(${vehicle.year})` : ''}</p>
        </div>
      </div>

      {/* Revision notice */}
      {estimate.is_revision && estimate.change_summary && (
        <div className="mb-4 rounded border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800">
          <strong>Revision Note:</strong> {estimate.change_summary}
        </div>
      )}

      {/* Labour lines */}
      {estimate.labour_lines_snapshot.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Labour</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-300 text-xs text-gray-500">
                <th className="py-1 text-start">Description</th>
                <th className="py-1 text-end w-16">Hours</th>
                <th className="py-1 text-end w-20">Rate</th>
                <th className="py-1 text-end w-24">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {estimate.labour_lines_snapshot.map((line, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5">{line.description as string}</td>
                  <td className="py-1.5 text-end">{fmt(Number(line.hours))}</td>
                  <td className="py-1.5 text-end">{fmt(Number(line.rate))}</td>
                  <td className="py-1.5 text-end font-medium">{fmt(Number(line.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Parts lines */}
      {estimate.parts_lines_snapshot.length > 0 && (
        <div className="mb-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Parts</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-300 text-xs text-gray-500">
                <th className="py-1 text-start">Description</th>
                <th className="py-1 text-end w-12">Qty</th>
                <th className="py-1 text-end w-20">Price</th>
                <th className="py-1 text-end w-24">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {estimate.parts_lines_snapshot.map((line, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5">{line.part_name as string}</td>
                  <td className="py-1.5 text-end">{Number(line.quantity)}</td>
                  <td className="py-1.5 text-end">{fmt(Number(line.sell_price))}</td>
                  <td className="py-1.5 text-end font-medium">{fmt(Number(line.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totals */}
      <div className="border-t-2 border-gray-800 pt-3 mt-4">
        <div className="flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Labour</span>
              <span>{fmt(estimate.labour_total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Parts</span>
              <span>{fmt(estimate.parts_total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">IVA ({estimate.tax_rate}%)</span>
              <span>{fmt(estimate.tax_amount)}</span>
            </div>
            <div className="flex justify-between text-lg font-black border-t border-gray-300 pt-1">
              <span>TOTAL</span>
              <span>{fmt(estimate.grand_total)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Approval section */}
      <div className="mt-12 border-t border-gray-200 pt-6">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs text-gray-500 mb-1">I authorize the above work to be performed:</p>
            <div className="border-b border-gray-400 h-12 mt-4" />
            <p className="text-xs text-gray-500 mt-1">Customer Signature</p>
          </div>
          <div>
            <div className="border-b border-gray-400 h-12 mt-8" />
            <p className="text-xs text-gray-500 mt-1">Date</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-gray-400">
        <p>Generated by MECANIX Workshop Management</p>
      </div>

      {/* Print button (hidden in print) */}
      <div className="mt-4 text-center print:hidden">
        <button onClick={() => window.print()} className="rounded-md bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700">
          Print / Save PDF
        </button>
      </div>
    </div>
  );
}
