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

export function useDeferredServices(status?: string, filters?: { vehicleId?: string; customerId?: string }) {
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (filters?.vehicleId) qs.set('vehicleId', filters.vehicleId);
  if (filters?.customerId) qs.set('customerId', filters.customerId);
  const params = qs.toString() ? `?${qs}` : '';
  return useQuery({
    queryKey: ['deferred-services', status, filters?.vehicleId, filters?.customerId],
    queryFn: () => api.get<DeferredService[]>(`/deferred-services${params}`),
  });
}

export function useCreateDeferred() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      customerId: string;
      vehicleId: string;
      description: string;
      estimatedCost?: number;
      priority?: 'red' | 'yellow';
      followUpDate?: string;
      originalJobCardId?: string;
    }) => api.post('/deferred-services', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deferred-services'] });
      qc.invalidateQueries({ queryKey: ['deferred-summary'] });
    },
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
