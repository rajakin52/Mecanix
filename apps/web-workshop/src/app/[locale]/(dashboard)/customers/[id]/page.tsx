'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCustomer, useCustomerLtv, useUpdateCustomer, useDeleteCustomer } from '@/hooks/use-customers';
import { useVehicles } from '@/hooks/use-vehicles';
import { useLoyalty, useLoyaltyTransactions, useEarnPoints, useRedeemPoints } from '@/hooks/use-loyalty';
import { useCustomerComms } from '@/hooks/use-comms';
import { Link, useRouter } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateCustomerSchema } from '@mecanix/validators';
import type { UpdateCustomerInput } from '@mecanix/validators';
import { Building2 } from 'lucide-react';
import { usePriceGroups } from '@/hooks/use-pricing';

const PAYMENT_TERMS_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'Immediate', label: 'Immediate' },
  { value: 'Net 15', label: 'Net 15' },
  { value: 'Net 30', label: 'Net 30' },
  { value: 'Net 45', label: 'Net 45' },
  { value: 'Net 60', label: 'Net 60' },
  { value: 'Net 90', label: 'Net 90' },
  { value: 'COD', label: 'COD' },
];

function CustomerStatement({ customerId }: { customerId: string }) {
  const [showStatement, setShowStatement] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statement, setStatement] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchStatement = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString();
      const { api } = await import('@/lib/api');
      const data = await api.get<Record<string, unknown>>(`/reports/statements/customer/${customerId}${qs ? `?${qs}` : ''}`);
      setStatement(data);
    } catch {
      setStatement(null);
    }
    setLoading(false);
  };

  if (!showStatement) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Statement of Account</h2>
          <button
            onClick={() => { setShowStatement(true); fetchStatement(); }}
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            View Statement
          </button>
        </div>
      </div>
    );
  }

  const transactions = (statement?.transactions ?? []) as Array<{
    date: string; type: string; reference: string; description: string;
    debit: number; credit: number; runningBalance: number;
  }>;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Statement of Account</h2>
        <button
          onClick={() => setShowStatement(false)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Hide
        </button>
      </div>

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
        <button onClick={fetchStatement} disabled={loading}
          className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Summary */}
      {statement && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-md bg-gray-50 p-3 text-center">
            <div className="text-xs text-gray-500">Opening Balance</div>
            <div className="text-lg font-bold text-gray-900">{Number(statement.openingBalance).toFixed(2)}</div>
          </div>
          <div className="rounded-md bg-gray-50 p-3 text-center">
            <div className="text-xs text-gray-500">Total Invoiced</div>
            <div className="text-lg font-bold text-red-700">{Number(statement.totalDebits).toFixed(2)}</div>
          </div>
          <div className="rounded-md bg-gray-50 p-3 text-center">
            <div className="text-xs text-gray-500">Total Paid</div>
            <div className="text-lg font-bold text-green-700">{Number(statement.totalCredits).toFixed(2)}</div>
          </div>
        </div>
      )}

      {/* Closing balance */}
      {statement && (
        <div className="mb-4 rounded-md border-2 border-primary-200 bg-primary-50 p-3 text-center">
          <div className="text-xs text-primary-600 font-medium">Outstanding Balance</div>
          <div className="text-2xl font-bold text-primary-800">{Number(statement.closingBalance).toFixed(2)}</div>
        </div>
      )}

      {/* Transactions table */}
      {loading ? (
        <p className="text-sm text-gray-500 text-center py-4">Loading statement...</p>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No transactions found for this period.</p>
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
              {transactions.map((tx, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-700">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      tx.type === 'invoice' ? 'bg-blue-100 text-blue-700' :
                      tx.type === 'payment' ? 'bg-green-100 text-green-700' :
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
    </div>
  );
}

export default function CustomerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const tc = useTranslations('customers');
  const tv = useTranslations('vehicles');
  const t = useTranslations('common');
  const tl = useTranslations('loyalty');

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editIsCorporate, setEditIsCorporate] = useState(false);
  const [showEarnModal, setShowEarnModal] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [earnAmount, setEarnAmount] = useState('');
  const [earnInvoiceId, setEarnInvoiceId] = useState('');
  const [redeemPoints, setRedeemPointsVal] = useState('');
  const [redeemDesc, setRedeemDesc] = useState('');

  const { data: customer, isLoading, isError } = useCustomer(id);
  const { data: ltv } = useCustomerLtv(id);
  const { data: vehiclesData, isLoading: vehiclesLoading } = useVehicles(1, '', id);
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();
  const { data: priceGroups } = usePriceGroups();
  const pgList = Array.isArray(priceGroups) ? priceGroups : [];
  const { data: loyalty } = useLoyalty(id);
  const { data: loyaltyTxs } = useLoyaltyTransactions(id);
  const earnMutation = useEarnPoints();
  const redeemMutation = useRedeemPoints();

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<UpdateCustomerInput>({
    resolver: zodResolver(updateCustomerSchema),
  });

  useEffect(() => {
    if (customer) {
      const corp = !!customer.is_corporate;
      setEditIsCorporate(corp);
      reset({
        fullName: customer.full_name ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        taxId: customer.tax_id ?? '',
        address: customer.address ?? '',
        paymentTerms: customer.payment_terms ?? '',
        notes: customer.notes ?? '',
        isCorporate: corp,
        companyName: customer.company_name ?? '',
        billingContact: customer.billing_contact ?? '',
        creditLimit: customer.credit_limit ?? undefined,
        priceGroupId: customer.price_group_id ?? '',
        materialsRateRefinish: customer.materials_rate_refinish ?? null,
        materialsRateBody: customer.materials_rate_body ?? null,
        // shop_supplies_pct stored 0..1; the form input uses 0..100, so
        // convert when seeding. The submit handler converts back below.
        shopSuppliesPct: customer.shop_supplies_pct != null
          ? Number(customer.shop_supplies_pct) * 100
          : null,
        shopSuppliesCap: customer.shop_supplies_cap ?? null,
        preferredLanguage: (customer.preferred_language as 'en' | 'pt-PT' | 'pt-BR' | null | undefined) ?? null,
      });
    }
  }, [customer, reset]);

  const onSubmit = async (formData: UpdateCustomerInput) => {
    // Form shows shop_supplies_pct as 0..100; DB stores 0..1
    const normalised = { ...formData } as UpdateCustomerInput;
    if (normalised.shopSuppliesPct != null) {
      normalised.shopSuppliesPct = Number(normalised.shopSuppliesPct) / 100;
    }
    await updateMutation.mutateAsync({ id, ...normalised });
    setShowEditModal(false);
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(id);
    router.push('/customers');
  };

  if (isLoading) {
    return <p className="text-gray-500">{t('loading')}</p>;
  }

  if (isError || !customer) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{t('error')}</p>
        <Link href="/customers" className="mt-4 inline-block text-primary-600 hover:text-primary-700">
          {t('back')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Back button */}
      <div className="mb-6">
        <Link
          href="/customers"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; {t('back')}
        </Link>
      </div>

      {/* Lifetime value snapshot — billing + margin rollup across every
          invoice ever issued to this customer. Read-only summary that
          frames the rest of the page. */}
      {ltv && ltv.invoice_count > 0 && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Lifetime snapshot
            </h2>
            <span className="text-xs text-gray-500">
              {ltv.invoice_count} invoice{ltv.invoice_count === 1 ? '' : 's'}
              {ltv.first_invoice_date && (
                <> · since {new Date(ltv.first_invoice_date).toLocaleDateString()}</>
              )}
              {ltv.days_since_last_visit != null && (
                <> · last visit {ltv.days_since_last_visit}d ago</>
              )}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat
              label="Lifetime revenue"
              value={ltv.lifetime_revenue.toLocaleString(undefined, { style: 'currency', currency: 'AOA' })}
              hint="Sum of grand totals"
            />
            <Stat
              label="Lifetime paid"
              value={ltv.lifetime_paid.toLocaleString(undefined, { style: 'currency', currency: 'AOA' })}
              hint="Across all payments"
              tone="emerald"
            />
            <Stat
              label="Outstanding"
              value={ltv.outstanding_balance.toLocaleString(undefined, { style: 'currency', currency: 'AOA' })}
              hint="Unpaid balance"
              tone={ltv.outstanding_balance > 0 ? 'red' : 'gray'}
            />
            <Stat
              label="Avg invoice"
              value={ltv.average_invoice_value.toLocaleString(undefined, { style: 'currency', currency: 'AOA' })}
              hint={`${ltv.invoice_count} total`}
            />
            <Stat
              label="Parts margin"
              value={`${ltv.parts_margin_pct.toFixed(1)}%`}
              hint={`${ltv.parts_margin.toLocaleString(undefined, { style: 'currency', currency: 'AOA' })} on ${ltv.parts_line_count} lines`}
              tone={ltv.parts_margin_pct < 0 ? 'red' : ltv.parts_margin_pct < 10 ? 'amber' : 'emerald'}
            />
            <Stat
              label="Credit notes"
              value={ltv.credit_notes_total.toLocaleString(undefined, { style: 'currency', currency: 'AOA' })}
              hint="Returned to customer"
              tone={ltv.credit_notes_total > 0 ? 'amber' : 'gray'}
            />
          </div>
        </div>
      )}

      {/* Customer Profile Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{customer.full_name}</h1>
            {customer.is_corporate && (
              <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                <Building2 className="h-3.5 w-3.5" />
                {tc('corporate')}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditModal(true)}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              {t('edit')}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              {t('delete')}
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('phone')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{customer.phone || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('email')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{customer.email || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('taxId')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{customer.tax_id || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('paymentTerms')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{customer.payment_terms || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Price Group</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {pgList.find((pg) => pg.id === customer.price_group_id)?.name || 'Default'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('address')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{customer.address || '-'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">{tc('notes')}</dt>
            <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{customer.notes || '-'}</dd>
          </div>

          {customer.is_corporate && (
            <>
              <div>
                <dt className="text-sm font-medium text-gray-500">{tc('companyName')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.company_name || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{tc('billingContact')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.billing_contact || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{tc('creditLimit')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.credit_limit != null ? customer.credit_limit.toFixed(2) : '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{tc('currentBalance')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{customer.current_balance != null ? customer.current_balance.toFixed(2) : '0.00'}</dd>
              </div>
            </>
          )}
        </dl>
      </div>

      {/* Linked Vehicles */}
      <div className="mt-8">
        <h2 className="mb-4 text-xl font-semibold text-gray-900">{tv('linkedVehicles')}</h2>

        {vehiclesLoading ? (
          <p className="text-gray-500">{t('loading')}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tv('plate')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tv('make')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tv('model')}</th>
                  <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tv('year')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {vehiclesData?.data && vehiclesData.data.length > 0 ? (
                  vehiclesData.data.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/vehicles/${vehicle.id}`}>
                          {vehicle.plate}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.make}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.model}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.year}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                      {tv('noVehicles')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Loyalty Program */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{tl('title')}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEarnModal(true)}
              className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              {tl('earnPoints')}
            </button>
            <button
              onClick={() => setShowRedeemModal(true)}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
            >
              {tl('redeemPoints')}
            </button>
          </div>
        </div>

        {/* Loyalty Card */}
        {loyalty && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{tl('currentPoints')}</p>
                <p className="text-3xl font-bold text-gray-900">{loyalty.points}</p>
              </div>
              <div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${
                  loyalty.tier === 'platinum' ? 'bg-gray-800 text-white' :
                  loyalty.tier === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                  loyalty.tier === 'silver' ? 'bg-gray-200 text-gray-700' :
                  'bg-orange-100 text-orange-700'
                }`}>
                  {tl(`tier_${loyalty.tier}`)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Points History */}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tl('date')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tl('type')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{tl('description')}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tl('points')}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{tl('balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loyaltyTxs && loyaltyTxs.length > 0 ? (
                loyaltyTxs.map((tx) => (
                  <tr key={tx.id}>
                    <td className="px-4 py-3 text-sm text-gray-600">{new Date(tx.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        tx.transaction_type === 'earn' ? 'bg-green-100 text-green-700' :
                        tx.transaction_type === 'redeem' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {tl(`txType_${tx.transaction_type}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{tx.description}</td>
                    <td className={`px-4 py-3 text-end text-sm font-medium ${tx.points > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.points > 0 ? '+' : ''}{tx.points}
                    </td>
                    <td className="px-4 py-3 text-end text-sm text-gray-900">{tx.balance_after}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">{tl('noTransactions')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Communications log */}
      <CustomerCommsPanel customerId={id} />

      {/* Statement of Account */}
      <CustomerStatement customerId={id} />

      {/* Earn Points Modal */}
      {showEarnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{tl('earnPoints')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tl('invoiceId')}</label>
                <input value={earnInvoiceId} onChange={(e) => setEarnInvoiceId(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tl('amount')}</label>
                <input type="number" step="0.01" min="0" value={earnAmount} onChange={(e) => setEarnAmount(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowEarnModal(false)} className="rounded-md border px-4 py-2 text-sm">{t('cancel')}</button>
                <button
                  onClick={async () => {
                    if (earnInvoiceId && earnAmount) {
                      await earnMutation.mutateAsync({ customerId: id, invoiceId: earnInvoiceId, amount: parseFloat(earnAmount) });
                      setShowEarnModal(false);
                      setEarnAmount('');
                      setEarnInvoiceId('');
                    }
                  }}
                  disabled={earnMutation.isPending}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {earnMutation.isPending ? t('loading') : tl('earnPoints')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Redeem Points Modal */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{tl('redeemPoints')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tl('points')}</label>
                <input type="number" min="1" value={redeemPoints} onChange={(e) => setRedeemPointsVal(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tl('description')}</label>
                <input value={redeemDesc} onChange={(e) => setRedeemDesc(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRedeemModal(false)} className="rounded-md border px-4 py-2 text-sm">{t('cancel')}</button>
                <button
                  onClick={async () => {
                    if (redeemPoints && redeemDesc) {
                      await redeemMutation.mutateAsync({ customerId: id, points: parseInt(redeemPoints, 10), description: redeemDesc });
                      setShowRedeemModal(false);
                      setRedeemPointsVal('');
                      setRedeemDesc('');
                    }
                  }}
                  disabled={redeemMutation.isPending}
                  className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {redeemMutation.isPending ? t('loading') : tl('redeemPoints')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{tc('editCustomer')}</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">&#10005;</button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('fullName')}</label>
                <input {...register('fullName')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('phone')}</label>
                <input {...register('phone')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('email')}</label>
                <input {...register('email')} type="email" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('taxId')}</label>
                <input {...register('taxId')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('paymentTerms')}</label>
                <select {...register('paymentTerms')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
                  {PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Price Group</label>
                <select {...register('priceGroupId')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
                  <option value="">— Default pricing —</option>
                  {pgList.map((pg) => (
                    <option key={pg.id} value={pg.id}>{pg.name} ({pg.default_markup_pct}%)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Preferred Language</label>
                <select {...register('preferredLanguage')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white">
                  <option value="">Use workshop default</option>
                  <option value="pt-PT">Português (PT)</option>
                  <option value="pt-BR">Português (BR)</option>
                  <option value="en">English</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">Overrides the workshop locale for this customer&apos;s emails, WhatsApp, and statements.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('address')}</label>
                <input {...register('address')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{tc('notes')}</label>
                <textarea {...register('notes')} rows={3} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>

              {/* Corporate Account Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="editIsCorporate"
                  checked={editIsCorporate}
                  onChange={(e) => {
                    setEditIsCorporate(e.target.checked);
                    setValue('isCorporate', e.target.checked);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="editIsCorporate" className="text-sm font-medium text-gray-700">{tc('corporateAccount')}</label>
              </div>

              {editIsCorporate && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{tc('companyName')}</label>
                    <input {...register('companyName')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{tc('billingContact')}</label>
                    <input {...register('billingContact')} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{tc('creditLimit')}</label>
                    <input {...register('creditLimit')} type="number" min="0" step="0.01" className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                </>
              )}

              <div className="rounded-md border border-blue-200 bg-blue-50/40 p-3">
                <div className="mb-1 text-sm font-semibold text-gray-700">Materials rate overrides</div>
                <p className="mb-3 text-xs text-gray-500">
                  Optional. Override the insurance and tenant defaults for jobs billed directly to this customer. Leave empty to inherit.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500">Refinish rate (per hour)</label>
                    <input
                      {...register('materialsRateRefinish')}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="inherit"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Body rate (per hour)</label>
                    <input
                      {...register('materialsRateBody')}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="inherit"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Shop supplies (% of mech labour)</label>
                    <input
                      {...register('shopSuppliesPct')}
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="inherit"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Shop supplies cap</label>
                    <input
                      {...register('shopSuppliesCap')}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="inherit"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {updateMutation.isPending ? t('loading') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{t('confirmDelete')}</h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <strong>{customer.full_name}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? t('loading') : t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  push: 'Push',
  email: 'Email',
};

const STATUS_COLOR: Record<string, string> = {
  sent: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  read: 'bg-green-100 text-green-700',
  queued: 'bg-gray-100 text-gray-600',
  failed: 'bg-red-100 text-red-700',
};

function CustomerCommsPanel({ customerId }: { customerId: string }) {
  const { data, isLoading } = useCustomerComms({ customerId });
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = data ?? [];

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Communications</h2>
          <p className="text-xs text-gray-500">
            Every automated WhatsApp / SMS / push this customer received.
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {isLoading ? '…' : rows.length}
        </span>
      </div>

      {isLoading ? (
        <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">No comms recorded for this customer.</p>
      ) : (
        <ul className="divide-y">
          {rows.map((c) => {
            const open = expanded === c.id;
            return (
              <li key={c.id} className="py-3">
                <button
                  onClick={() => setExpanded(open ? null : c.id)}
                  className="flex w-full items-start justify-between text-start"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                        {CHANNEL_LABEL[c.channel] ?? c.channel}
                      </span>
                      <span className="text-gray-900">{c.template_key}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-xs ${STATUS_COLOR[c.delivery_status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {c.delivery_status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(c.sent_at).toLocaleString()}
                      {c.recipient ? <span className="ms-2">to {c.recipient}</span> : null}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{open ? '\u25B2' : '\u25BC'}</span>
                </button>
                {open && c.body ? (
                  <pre className="mt-2 whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-xs text-gray-800">
                    {c.body}
                  </pre>
                ) : null}
                {open && c.delivery_error ? (
                  <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">
                    Error: {c.delivery_error}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = 'gray',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'gray' | 'emerald' | 'red' | 'amber';
}) {
  const toneClass: Record<string, string> = {
    gray: 'text-gray-900',
    emerald: 'text-emerald-700',
    red: 'text-red-600',
    amber: 'text-amber-700',
  };
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50/60 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className={`mt-0.5 text-base font-bold tabular-nums ${toneClass[tone]}`}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-gray-500">{hint}</div>}
    </div>
  );
}
