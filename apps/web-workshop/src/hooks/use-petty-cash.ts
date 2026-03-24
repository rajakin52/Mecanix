'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface PettyCashTransaction {
  id: string;
  transaction_type: 'deposit' | 'withdrawal';
  amount: number;
  description: string;
  category: string | null;
  reference: string | null;
  transaction_date: string;
  created_at: string;
}

interface PettyCashBalance {
  balance: number;
}

interface CreatePettyCashDto {
  transactionType: 'deposit' | 'withdrawal';
  amount: number;
  description: string;
  category?: string;
  reference?: string;
  transactionDate?: string;
}

export function usePettyCash(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['petty-cash', startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString();
      return api.get<PettyCashTransaction[]>(`/petty-cash${qs ? `?${qs}` : ''}`);
    },
  });
}

export function usePettyCashBalance() {
  return useQuery({
    queryKey: ['petty-cash', 'balance'],
    queryFn: () => api.get<PettyCashBalance>('/petty-cash/balance'),
  });
}

export function useCreatePettyCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePettyCashDto) =>
      api.post<PettyCashTransaction>('/petty-cash', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['petty-cash'] });
    },
  });
}
