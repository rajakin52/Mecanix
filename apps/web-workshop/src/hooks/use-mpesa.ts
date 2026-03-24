'use client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useMpesaConfigured() {
  return useQuery({
    queryKey: ['mpesa-configured'],
    queryFn: () => api.get<{ configured: boolean }>('/mpesa/configured'),
  });
}

export function useMpesaPay() {
  return useMutation({
    mutationFn: (data: { phoneNumber: string; amount: number; invoiceId: string }) =>
      api.post('/mpesa/pay', data),
  });
}
