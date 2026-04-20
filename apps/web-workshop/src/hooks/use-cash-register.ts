'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type R = Record<string, unknown>;

export function useCurrentRegister() {
  return useQuery<R | null>({
    queryKey: ['cash-register', 'current'],
    queryFn: () => api.get<R | null>('/cash-register/current'),
  });
}

export function useRegisterTransactions() {
  return useQuery<R[]>({
    queryKey: ['cash-register', 'transactions'],
    queryFn: () => api.get<R[]>('/cash-register/transactions'),
  });
}

export function useRegisterReport(registerId?: string) {
  return useQuery<R>({
    queryKey: ['cash-register', 'report', registerId],
    queryFn: () =>
      api.get<R>(
        `/cash-register/report${registerId ? `?registerId=${registerId}` : ''}`,
      ),
  });
}

export function useOpenRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { openingFloat: number; branchId?: string }) =>
      api.post<R>('/cash-register/open', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-register'] }),
  });
}

export function useCloseRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { closingCash: number; closeNotes?: string }) =>
      api.post<R>('/cash-register/close', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-register'] }),
  });
}

export function useAddTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      transactionType: 'payment' | 'refund' | 'petty_cash' | 'deposit' | 'adjustment' | 'float';
      paymentMethod?: string;
      amount: number;
      description?: string;
      reference?: string;
    }) => api.post<R>('/cash-register/transactions', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-register'] }),
  });
}

export function useAddBankDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      amount: number;
      bankName: string;
      accountNumber?: string;
      depositReference: string;
      depositDate?: string;
      notes?: string;
    }) => api.post<R>('/cash-register/bank-deposits', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-register'] }),
  });
}
