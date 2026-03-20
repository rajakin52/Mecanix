'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useInsuranceCompanies() {
  return useQuery({
    queryKey: ['insurance-companies'],
    queryFn: () => api.get<Array<Record<string, unknown>>>('/insurance/companies'),
  });
}

export function useCreateInsuranceCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/insurance/companies', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance-companies'] }),
  });
}

export function useClaims(page = 1, status?: string) {
  return useQuery({
    queryKey: ['claims', page, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (status) params.set('status', status);
      return api.get<{ data: Array<Record<string, unknown>>; meta: Record<string, number> }>(`/insurance/claims?${params}`);
    },
  });
}

export function useClaim(id: string) {
  return useQuery({
    queryKey: ['claim', id],
    queryFn: () => api.get<Record<string, unknown>>(`/insurance/claims/${id}`),
    enabled: !!id,
  });
}

export function useInitiateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobCardId: string; insuranceCompanyId: string; policyNumber?: string; excessAmount?: number }) =>
      api.post('/insurance/claims', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useChangeClaimStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status: string; notes?: string }) =>
      api.post(`/insurance/claims/${id}/status`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['claim', v.id] });
      qc.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

export function useCreateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (claimId: string) => api.post(`/insurance/claims/${claimId}/estimates`, {}),
    onSuccess: (_d, claimId) => qc.invalidateQueries({ queryKey: ['claim', claimId] }),
  });
}

export function useEstimate(id: string) {
  return useQuery({
    queryKey: ['estimate', id],
    queryFn: () => api.get<Record<string, unknown>>(`/insurance/estimates/${id}`),
    enabled: !!id,
  });
}

export function useApproveEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; assessorName: string; notes?: string }) =>
      api.post(`/insurance/estimates/${id}/approve`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });
}
