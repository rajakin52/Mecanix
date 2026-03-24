'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface LoyaltyInfo {
  customerId: string;
  name: string;
  points: number;
  tier: string;
}

interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  transaction_type: string;
  points: number;
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

export function useLoyalty(customerId: string) {
  return useQuery({
    queryKey: ['loyalty', customerId],
    queryFn: () => api.get<LoyaltyInfo>(`/loyalty/${customerId}`),
    enabled: !!customerId,
  });
}

export function useLoyaltyTransactions(customerId: string) {
  return useQuery({
    queryKey: ['loyalty-transactions', customerId],
    queryFn: () => api.get<LoyaltyTransaction[]>(`/loyalty/${customerId}/transactions`),
    enabled: !!customerId,
  });
}

export function useEarnPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, invoiceId, amount }: { customerId: string; invoiceId: string; amount: number }) =>
      api.post(`/loyalty/${customerId}/earn`, { invoiceId, amount }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['loyalty', v.customerId] });
      qc.invalidateQueries({ queryKey: ['loyalty-transactions', v.customerId] });
      qc.invalidateQueries({ queryKey: ['customer', v.customerId] });
    },
  });
}

export function useRedeemPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, points, description }: { customerId: string; points: number; description: string }) =>
      api.post(`/loyalty/${customerId}/redeem`, { points, description }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['loyalty', v.customerId] });
      qc.invalidateQueries({ queryKey: ['loyalty-transactions', v.customerId] });
      qc.invalidateQueries({ queryKey: ['customer', v.customerId] });
    },
  });
}
