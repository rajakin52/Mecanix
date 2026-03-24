'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePettyCash, usePettyCashBalance, useCreatePettyCash } from '@/hooks/use-petty-cash';

const PETTY_CASH_CATEGORIES = ['Supplies', 'Transport', 'Food', 'Tools', 'Cleaning', 'Other'];

export default function PettyCashPage() {
  const t = useTranslations('pettyCash');
  const tc = useTranslations('common');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [form, setForm] = useState({
    transactionType: 'deposit' as 'deposit' | 'withdrawal',
    amount: 0,
    description: '',
    category: '',
    reference: '',
    transactionDate: new Date().toISOString().slice(0, 10),
  });

  const { data: transactions, isLoading } = usePettyCash(
    startDate || undefined,
    endDate || undefined,
  );
  const { data: balanceData } = usePettyCashBalance();
  const createMutation = useCreatePettyCash();

  const handleCreate = async () => {
    try {
      setFormError(null);
      await createMutation.mutateAsync({
        transactionType: form.transactionType,
        amount: Number(form.amount),
        description: form.description,
        category: form.category || undefined,
        reference: form.reference || undefined,
        transactionDate: form.transactionDate || undefined,
      });
      setShowModal(false);
      setForm({
        transactionType: 'deposit',
        amount: 0,
        description: '',
        category: '',
        reference: '',
        transactionDate: new Date().toISOString().slice(0, 10),
      });
      setSuccessMsg(t('created'));
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create transaction');
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setForm({ ...form, transactionType: 'deposit' });
              setShowModal(true);
            }}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            {t('deposit')}
          </button>
          <button
            onClick={() => {
              setForm({ ...form, transactionType: 'withdrawal' });
              setShowModal(true);
            }}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            {t('withdrawal')}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}

      {/* Balance card */}
      <div className="mb-6 rounded-lg border border-primary-200 bg-primary-50 p-6">
        <p className="text-xs font-medium uppercase text-primary-600">{t('currentBalance')}</p>
        <p className="mt-1 text-3xl font-bold text-primary-700">
          {balanceData?.balance != null ? balanceData.balance.toFixed(2) : '0.00'}
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <span className="text-gray-400">-</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-500">{tc('loading')}</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('date')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('type')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('description')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('category')}</th>
                <th className="px-4 py-3 text-start text-xs font-semibold uppercase text-gray-500">{t('reference')}</th>
                <th className="px-4 py-3 text-end text-xs font-semibold uppercase text-gray-500">{t('amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {transactions && transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(tx.transaction_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.transaction_type === 'deposit'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {t(tx.transaction_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{tx.description}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{tx.category || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{tx.reference || '-'}</td>
                    <td className={`px-4 py-3 text-end text-sm font-medium ${
                      tx.transaction_type === 'deposit' ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {tx.transaction_type === 'deposit' ? '+' : '-'}{tx.amount.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                    {t('noTransactions')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {form.transactionType === 'deposit' ? t('deposit') : t('withdrawal')}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">&#x2715;</button>
            </div>
            <div className="space-y-4">
              {formError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('date')}</label>
                  <input
                    type="date"
                    value={form.transactionDate}
                    onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('amount')}</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">{t('description')}</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('category')}</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="">-</option>
                    {PETTY_CASH_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('reference')}</label>
                  <input
                    value={form.reference}
                    onChange={(e) => setForm({ ...form, reference: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-md border px-4 py-2 text-sm">
                  {tc('cancel')}
                </button>
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending || !form.description || form.amount <= 0}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? tc('loading') : tc('save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
