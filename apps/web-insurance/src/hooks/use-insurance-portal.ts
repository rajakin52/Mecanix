'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useClaims(page = 1, status?: string) {
  return useQuery({
    queryKey: ['portal-claims', page, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (status) params.set('status', status);
      return api.get<{ data: Array<Record<string, unknown>>; meta: Record<string, number> }>(`/insurance/portal/claims?${params}`);
    },
  });
}

export function useClaim(id: string) {
  return useQuery({
    queryKey: ['portal-claim', id],
    queryFn: () => api.get<Record<string, unknown>>(`/insurance/portal/claims/${id}`),
    enabled: !!id,
  });
}

export function useEstimate(id: string) {
  return useQuery({
    queryKey: ['portal-estimate', id],
    queryFn: () => api.get<Record<string, unknown>>(`/insurance/portal/estimates/${id}`),
    enabled: !!id,
  });
}

export function useReviewEstimateLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, ...data }: { lineId: string; status: string; assessorPrice?: number; notes?: string }) =>
      api.post(`/insurance/portal/estimate-lines/${lineId}/review`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-claim'] });
      qc.invalidateQueries({ queryKey: ['portal-estimate'] });
    },
  });
}

export function useApproveEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; assessorName: string; notes?: string }) =>
      api.post(`/insurance/portal/estimates/${id}/approve`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-claims'] });
      qc.invalidateQueries({ queryKey: ['portal-claim'] });
    },
  });
}

export function useRejectEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; assessorName: string; reason: string }) =>
      api.post(`/insurance/portal/estimates/${id}/reject`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portal-claims'] });
      qc.invalidateQueries({ queryKey: ['portal-claim'] });
    },
  });
}

export function usePortalDashboard() {
  return useQuery({
    queryKey: ['portal-dashboard'],
    queryFn: () => api.get<Record<string, unknown>>('/insurance/portal/dashboard'),
  });
}
