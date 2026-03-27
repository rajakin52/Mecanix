'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface DeferredService {
  id: string;
  description: string;
  estimated_cost: number | null;
  priority: string;
  follow_up_date: string | null;
  status: string;
  reminder_count: number;
  customer: { full_name: string; phone: string } | null;
  vehicle: { plate: string; make: string; model: string } | null;
  created_at: string;
}

interface DeferredSummary {
  totalPending: number;
  redCount: number;
  yellowCount: number;
  potentialRevenue: number;
}

export function useDeferredServices(status?: string) {
  const params = status ? `?status=${status}` : '';
  return useQuery({
    queryKey: ['deferred-services', status],
    queryFn: () => api.get<DeferredService[]>(`/deferred-services${params}`),
  });
}

export function useDeferredDue() {
  return useQuery({
    queryKey: ['deferred-services', 'due'],
    queryFn: () => api.get<DeferredService[]>('/deferred-services/due'),
  });
}

export function useDeferredSummary() {
  return useQuery({
    queryKey: ['deferred-summary'],
    queryFn: () => api.get<DeferredSummary>('/deferred-services/summary'),
  });
}

export function useRemindDeferred() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/deferred-services/${id}/remind`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deferred-services'] }),
  });
}

export function useConvertDeferred() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, jobCardId }: { id: string; jobCardId: string }) =>
      api.post(`/deferred-services/${id}/convert`, { jobCardId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deferred-services'] }),
  });
}
