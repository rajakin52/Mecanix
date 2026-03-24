'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AmcPackage {
  id: string;
  name: string;
  description: string | null;
  duration_months: number;
  price: number;
  services: string[];
  max_visits: number | null;
  is_active: boolean;
  created_at: string;
}

interface AmcSubscription {
  id: string;
  package_id: string;
  customer_id: string;
  vehicle_id: string | null;
  start_date: string;
  end_date: string;
  status: 'active' | 'expired' | 'cancelled';
  visits_used: number;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  package?: { id: string; name: string; price: number; max_visits: number | null };
  customer?: { id: string; full_name: string; phone: string | null };
  vehicle?: { id: string; plate: string; make: string; model: string } | null;
}

export function useAmcPackages() {
  return useQuery({
    queryKey: ['amc-packages'],
    queryFn: () => api.get<AmcPackage[]>('/amc/packages'),
  });
}

export function useCreateAmcPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<AmcPackage>('/amc/packages', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amc-packages'] }),
  });
}

export function useUpdateAmcPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.patch<AmcPackage>(`/amc/packages/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amc-packages'] }),
  });
}

export function useAmcSubscriptions(customerId?: string, status?: string) {
  return useQuery({
    queryKey: ['amc-subscriptions', customerId, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (customerId) params.set('customerId', customerId);
      if (status) params.set('status', status);
      const qs = params.toString();
      return api.get<AmcSubscription[]>(`/amc/subscriptions${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useCreateAmcSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<AmcSubscription>('/amc/subscriptions', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amc-subscriptions'] }),
  });
}

export function useRecordAmcVisit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<AmcSubscription>(`/amc/subscriptions/${id}/visit`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['amc-subscriptions'] }),
  });
}

export function useCheckAmcActive(customerId: string, vehicleId: string) {
  return useQuery({
    queryKey: ['amc-check', customerId, vehicleId],
    queryFn: () => api.get<{ active: boolean; subscription: AmcSubscription | null }>(`/amc/check/${customerId}/${vehicleId}`),
    enabled: !!customerId && !!vehicleId,
  });
}
