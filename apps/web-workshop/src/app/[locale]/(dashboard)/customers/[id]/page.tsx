'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/use-customers';
import { useVehicles } from '@/hooks/use-vehicles';
import { useLoyalty, useLoyaltyTransactions, useEarnPoints, useRedeemPoints } from '@/hooks/use-loyalty';
import { Link, useRouter } from '@/i18n/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateCustomerSchema } from '@mecanix/validators';
import type { UpdateCustomerInput } from '@mecanix/validators';
import { Building2 } from 'lucide-react';

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
  const { data: vehiclesData, isLoading: vehiclesLoading } = useVehicles(1, '', id);
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();
  const { data: loyalty } = useLoyalty(id);
  const { data: loyaltyTxs } = useLoyaltyTransactions(id);
  const earnMutation = useEarnPoints();
  const redeemMutation = useRedeemPoints();

  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm<UpdateCustomerInput>({
    resolver: zodResolver(updateCustomerSchema),
  });

  useEffect(() => {
    if (customer) {
      const corp = !!(customer as Record<string, unknown>).is_corporate;
      setEditIsCorporate(corp);
      reset({
        fullName: (customer as Record<string, unknown>).full_name as string ?? '',
        phone: (customer as Record<string, unknown>).phone as string ?? '',
        email: (customer as Record<string, unknown>).email as string ?? '',
        taxId: (customer as Record<string, unknown>).tax_id as string ?? '',
        address: (customer as Record<string, unknown>).address as string ?? '',
        paymentTerms: (customer as Record<string, unknown>).payment_terms as string ?? '',
        notes: (customer as Record<string, unknown>).notes as string ?? '',
        isCorporate: corp,
        companyName: (customer as Record<string, unknown>).company_name as string ?? '',
        billingContact: (customer as Record<string, unknown>).billing_contact as string ?? '',
        creditLimit: (customer as Record<string, unknown>).credit_limit as number ?? undefined,
      });
    }
  }, [customer, reset]);

  const onSubmit = async (formData: UpdateCustomerInput) => {
    await updateMutation.mutateAsync({ id, ...formData });
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

  const c = customer as Record<string, unknown>;

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

      {/* Customer Profile Card */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{c.full_name as string}</h1>
            {c.is_corporate && (
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
            <dd className="mt-1 text-sm text-gray-900">{(c.phone as string) || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('email')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{(c.email as string) || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('taxId')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{(c.tax_id as string) || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('paymentTerms')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{(c.payment_terms as string) || '-'}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{tc('address')}</dt>
            <dd className="mt-1 text-sm text-gray-900">{(c.address as string) || '-'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-gray-500">{tc('notes')}</dt>
            <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{(c.notes as string) || '-'}</dd>
          </div>

          {c.is_corporate && (
            <>
              <div>
                <dt className="text-sm font-medium text-gray-500">{tc('companyName')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{(c.company_name as string) || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{tc('billingContact')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{(c.billing_contact as string) || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{tc('creditLimit')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{c.credit_limit != null ? Number(c.credit_limit).toFixed(2) : '-'}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">{tc('currentBalance')}</dt>
                <dd className="mt-1 text-sm text-gray-900">{c.current_balance != null ? Number(c.current_balance).toFixed(2) : '0.00'}</dd>
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
                  vehiclesData.data.map((vehicle: Record<string, unknown>) => (
                    <tr key={vehicle.id as string} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-primary-600 hover:text-primary-700">
                        <Link href={`/vehicles/${vehicle.id as string}`}>
                          {vehicle.plate as string}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.make as string}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.model as string}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{vehicle.year as number}</td>
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
              Are you sure you want to delete <strong>{c.full_name as string}</strong>? This action cannot be undone.
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
