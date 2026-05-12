'use client';

import { useState } from 'react';
import {
  useCurrentRegister,
  useRegisterTransactions,
  useRegisterReport,
  useOpenRegister,
  useCloseRegister,
  useAddTransaction,
  useAddBankDeposit,
} from '@/hooks/use-cash-register';
import { formatCurrency, formatDate } from '@/lib/format';
import { useToast } from '@mecanix/ui-web';

const PAYMENT_METHODS = [
  'cash',
  'card',
  'mpesa',
  'multicaixa',
  'emola',
  'pix',
  'mbway',
  'multibanco',
  'transfer',
  'other',
];

export default function CashRegisterPage() {
  const toast = useToast();
  const { data: current, isLoading } = useCurrentRegister();
  const { data: transactions } = useRegisterTransactions();
  const { data: report } = useRegisterReport();

  const open = useOpenRegister();
  const close = useCloseRegister();
  const addTxn = useAddTransaction();
  const addDep = useAddBankDeposit();

  const reg = current as Record<string, unknown> | null;
  const isOpen = Boolean(reg);

  const [openingFloat, setOpeningFloat] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [txnForm, setTxnForm] = useState({ type: 'petty_cash', method: 'cash', amount: '', description: '', reference: '' });
  const [depForm, setDepForm] = useState({
    amount: '',
    bankName: '',
    accountNumber: '',
    reference: '',
    notes: '',
    sourcePaymentMethod: 'cash',
    destinationType: 'bank_account' as 'bank_account' | 'debit_card' | 'other',
  });
  const [depOpen, setDepOpen] = useState(false);

  const txns = (transactions ?? []) as Array<Record<string, unknown>>;
  const rpt = (report ?? {}) as Record<string, unknown>;

  const handleOpen = async () => {
    if (openingFloat === '') return toast.error('Enter the opening float');
    try {
      await open.mutateAsync({ openingFloat: Number(openingFloat) });
      setOpeningFloat('');
      toast.success('Register opened');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleClose = async () => {
    if (closingCash === '') return toast.error('Count the cash drawer first');
    try {
      await close.mutateAsync({ closingCash: Number(closingCash), closeNotes: closeNotes || undefined });
      setClosingCash('');
      setCloseNotes('');
      toast.success('Register closed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleTxn = async () => {
    if (!txnForm.amount) return toast.error('Amount required');
    try {
      await addTxn.mutateAsync({
        transactionType: txnForm.type as 'petty_cash',
        paymentMethod: txnForm.method,
        amount: Number(txnForm.amount),
        description: txnForm.description || undefined,
        reference: txnForm.reference || undefined,
      });
      setTxnForm({ type: 'petty_cash', method: 'cash', amount: '', description: '', reference: '' });
      toast.success('Transaction added');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDeposit = async () => {
    if (!depForm.amount || !depForm.bankName || !depForm.reference) return toast.error('Amount, bank and reference required');
    try {
      await addDep.mutateAsync({
        amount: Number(depForm.amount),
        bankName: depForm.bankName,
        accountNumber: depForm.accountNumber || undefined,
        depositReference: depForm.reference,
        notes: depForm.notes || undefined,
        sourcePaymentMethod: depForm.sourcePaymentMethod,
        destinationType: depForm.destinationType,
      });
      setDepForm({
        amount: '',
        bankName: '',
        accountNumber: '',
        reference: '',
        notes: '',
        sourcePaymentMethod: 'cash',
        destinationType: 'bank_account',
      });
      setDepOpen(false);
      toast.success('Deposit recorded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed');
    }
  };

  if (isLoading) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Cash register</h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {isOpen ? 'Open' : 'Closed'}
        </span>
      </div>

      {!isOpen ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Open the register</h2>
          <p className="mb-4 text-sm text-gray-600">
            Count the opening float and open the till for the day.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">Opening float</label>
              <input
                type="number"
                step="0.01"
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleOpen}
              disabled={open.isPending}
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {open.isPending ? 'Opening…' : 'Open register'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <Kpi label="Opening float" value={formatCurrency(Number(reg?.opening_float ?? 0))} />
            <Kpi label="Cash in" value={formatCurrency(Number(rpt.cash_in ?? 0))} />
            <Kpi label="Cash out" value={formatCurrency(Number(rpt.cash_out ?? 0))} />
            <Kpi
              label="Expected cash"
              value={formatCurrency(Number(rpt.expected_cash ?? 0))}
              hint="Float + cash in − cash out"
            />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Add transaction */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">Add transaction</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={txnForm.type}
                    onChange={(e) => setTxnForm({ ...txnForm, type: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="petty_cash">Petty cash</option>
                    <option value="payment">Payment received</option>
                    <option value="refund">Refund</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="float">Float adjustment</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Method</label>
                  <select
                    value={txnForm.method}
                    onChange={(e) => setTxnForm({ ...txnForm, method: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Amount <span className="text-xs text-gray-400">(negative for outflow)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={txnForm.amount}
                    onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <input
                    value={txnForm.description}
                    onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Reference</label>
                  <input
                    value={txnForm.reference}
                    onChange={(e) => setTxnForm({ ...txnForm, reference: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleTxn}
                  disabled={addTxn.isPending}
                  className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {addTxn.isPending ? 'Adding…' : 'Add'}
                </button>
              </div>
            </div>

            {/* Close register */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Close register</h2>
                <button
                  onClick={() => setDepOpen(true)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Record deposit / card reload &rarr;
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Counted cash</label>
                <input
                  type="number"
                  step="0.01"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {closingCash !== '' && rpt.expected_cash != null && (
                  <p className="mt-1 text-xs text-gray-500">
                    Variance:{' '}
                    <span
                      className={
                        Number(closingCash) - Number(rpt.expected_cash) === 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }
                    >
                      {formatCurrency(Number(closingCash) - Number(rpt.expected_cash))}
                    </span>
                  </p>
                )}
              </div>
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleClose}
                  disabled={close.isPending}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {close.isPending ? 'Closing…' : 'Close register'}
                </button>
              </div>
            </div>
          </div>

          {/* Transactions */}
          <h2 className="mb-3 text-lg font-semibold text-gray-900">Transactions today</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Time</th>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Type</th>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Method</th>
                  <th className="px-4 py-2 text-start text-xs font-semibold uppercase text-gray-500">Description</th>
                  <th className="px-4 py-2 text-end text-xs font-semibold uppercase text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {txns.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                      No transactions yet
                    </td>
                  </tr>
                ) : (
                  txns.map((t) => {
                    const amt = Number(t.amount ?? 0);
                    return (
                      <tr key={t.id as string}>
                        <td className="px-4 py-2 text-sm text-gray-500">{formatDate(t.created_at as string)}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{t.transaction_type as string}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">{t.payment_method as string}</td>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {(t.description as string) ?? ''}
                          {t.reference ? (
                            <div className="text-xs text-gray-500">ref: {t.reference as string}</div>
                          ) : null}
                        </td>
                        <td
                          className={`px-4 py-2 text-end text-sm font-medium ${
                            amt < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}
                        >
                          {formatCurrency(amt)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {depOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Deposit / card reload</h2>
                  <button onClick={() => setDepOpen(false)} className="text-gray-400 hover:text-gray-600">
                    &#x2715;
                  </button>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Source</label>
                      <select
                        value={depForm.sourcePaymentMethod}
                        onChange={(e) => setDepForm({ ...depForm, sourcePaymentMethod: e.target.value })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Destination</label>
                      <select
                        value={depForm.destinationType}
                        onChange={(e) => setDepForm({ ...depForm, destinationType: e.target.value as 'bank_account' | 'debit_card' | 'other' })}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                      >
                        <option value="bank_account">Bank account</option>
                        <option value="debit_card">Debit card</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  {depForm.sourcePaymentMethod !== 'cash' && (
                    <p className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      Non-cash sources don&apos;t affect the till&apos;s expected cash — this entry is pure bank/card reconciliation.
                    </p>
                  )}
                  <Field label="Amount" type="number" value={depForm.amount} onChange={(v) => setDepForm({ ...depForm, amount: v })} />
                  <Field
                    label={depForm.destinationType === 'debit_card' ? 'Card name' : 'Bank name'}
                    value={depForm.bankName}
                    onChange={(v) => setDepForm({ ...depForm, bankName: v })}
                  />
                  <Field
                    label={depForm.destinationType === 'debit_card' ? 'Card number' : 'Account number'}
                    value={depForm.accountNumber}
                    onChange={(v) => setDepForm({ ...depForm, accountNumber: v })}
                  />
                  <Field label="Reference" value={depForm.reference} onChange={(v) => setDepForm({ ...depForm, reference: v })} />
                  <Field label="Notes" value={depForm.notes} onChange={(v) => setDepForm({ ...depForm, notes: v })} />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setDepOpen(false)} className="rounded-md border px-4 py-2 text-sm">
                      Cancel
                    </button>
                    <button
                      onClick={handleDeposit}
                      disabled={addDep.isPending}
                      className="rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      {addDep.isPending ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
