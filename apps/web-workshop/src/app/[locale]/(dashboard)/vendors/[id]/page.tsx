'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface VendorDetail {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  lead_time_days: number | null;
  notes: string | null;
}

interface StatementTransaction {
  date: string;
  type: string;
  reference: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface Statement {
  entity: Record<string, unknown>;
  openingBalance: number;
  transactions: StatementTransaction[];
  closingBalance: number;
  totalDebits: number;
  totalCredits: number;
}

export default function VendorDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const tc = useTranslations('common');

  const { data: vendor, isLoading } = useQuery({
    queryKey: ['vendor', id],
    queryFn: () => api.get<VendorDetail>(`/vendors/${id}`),
    enabled: !!id,
  });

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statement, setStatement] = useState<Statement | null>(null);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [showStatement, setShowStatement] = useState(false);

  const fetchStatement = async () => {
    setStmtLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString();
      const data = await api.get<Statement>(`/reports/statements/vendor/${id}${qs ? `?${qs}` : ''}`);
      setStatement(data);
    } catch {
      setStatement(null);
    }
    setStmtLoading(false);
  };

  if (isLoading) return <p className="text-gray-500">{tc('loading')}</p>;
  if (!vendor) return <p className="text-gray-500">Vendor not found</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/vendors" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Back to Vendors
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
      </div>

      {/* Vendor Info */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
          {vendor.contact_name && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500">Contact</h3>
              <p className="mt-1 text-gray-900">{vendor.contact_name}</p>
            </div>
          )}
          {vendor.phone && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500">Phone</h3>
              <p className="mt-1 text-gray-900">{vendor.phone}</p>
            </div>
          )}
          {vendor.email && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500">Email</h3>
              <p className="mt-1 text-gray-900">{vendor.email}</p>
            </div>
          )}
          {vendor.payment_terms && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500">Payment Terms</h3>
              <p className="mt-1 text-gray-900">{vendor.payment_terms}</p>
            </div>
          )}
          {vendor.lead_time_days != null && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500">Lead Time</h3>
              <p className="mt-1 text-gray-900">{vendor.lead_time_days} days</p>
            </div>
          )}
          {vendor.address && (
            <div>
              <h3 className="text-sm font-semibold text-gray-500">Address</h3>
              <p className="mt-1 text-gray-900">{vendor.address}</p>
            </div>
          )}
        </div>
      </div>

      {/* Statement of Account */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Statement of Account</h2>
          {!showStatement ? (
            <button
              onClick={() => { setShowStatement(true); fetchStatement(); }}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              View Statement
            </button>
          ) : (
            <button onClick={() => setShowStatement(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Hide
            </button>
          )}
        </div>

        {showStatement && (
          <>
            {/* Date filters */}
            <div className="flex items-end gap-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500">From</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500">To</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm" />
              </div>
              <button onClick={fetchStatement} disabled={stmtLoading}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50">
                {stmtLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Summary */}
            {statement && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-md bg-gray-50 p-3 text-center">
                  <div className="text-xs text-gray-500">Total Billed</div>
                  <div className="text-lg font-bold text-red-700">{statement.totalDebits.toFixed(2)}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-3 text-center">
                  <div className="text-xs text-gray-500">Total Paid</div>
                  <div className="text-lg font-bold text-green-700">{statement.totalCredits.toFixed(2)}</div>
                </div>
                <div className="rounded-md border-2 border-primary-200 bg-primary-50 p-3 text-center">
                  <div className="text-xs text-primary-600 font-medium">Outstanding</div>
                  <div className="text-lg font-bold text-primary-800">{statement.closingBalance.toFixed(2)}</div>
                </div>
              </div>
            )}

            {/* Transactions */}
            {stmtLoading ? (
              <p className="text-sm text-gray-500 text-center py-4">Loading...</p>
            ) : !statement || statement.transactions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No transactions found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Date</th>
                      <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Type</th>
                      <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Reference</th>
                      <th className="px-3 py-2 text-start text-xs font-semibold uppercase text-gray-500">Description</th>
                      <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Debit</th>
                      <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Credit</th>
                      <th className="px-3 py-2 text-end text-xs font-semibold uppercase text-gray-500">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {statement.transactions.map((tx, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-700">{new Date(tx.date).toLocaleDateString()}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            tx.type === 'bill' ? 'bg-blue-100 text-blue-700' :
                            tx.type === 'bill_payment' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-900">{tx.reference}</td>
                        <td className="px-3 py-2 text-gray-700">{tx.description}</td>
                        <td className="px-3 py-2 text-end text-red-700">{tx.debit > 0 ? tx.debit.toFixed(2) : ''}</td>
                        <td className="px-3 py-2 text-end text-green-700">{tx.credit > 0 ? tx.credit.toFixed(2) : ''}</td>
                        <td className="px-3 py-2 text-end font-medium text-gray-900">{tx.runningBalance.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
