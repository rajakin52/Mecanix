'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Estimate {
  id: string;
  job_card_id: string;
  estimate_number: string;
  version: number;
  status: string;
  labour_total: number;
  parts_total: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  labour_lines_snapshot: unknown[];
  parts_lines_snapshot: unknown[];
  dvi_snapshot: unknown[] | null;
  is_revision: boolean;
  change_summary: string | null;
  sent_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  approval_method: string | null;
  approval_notes: string | null;
  valid_until: string | null;
  created_at: string;
}

export function useEstimates(jobId: string) {
  return useQuery({
    queryKey: ['estimates', jobId],
    queryFn: () => api.get<Estimate[]>(`/jobs/${jobId}/estimates`),
    enabled: !!jobId,
  });
}

export function useEstimate(id: string) {
  return useQuery({
    queryKey: ['estimate', id],
    queryFn: () => api.get<Estimate>(`/estimates/${id}`),
    enabled: !!id,
  });
}

export function useCreateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, ...data }: { jobId: string; terms?: string; validUntil?: string }) =>
      api.post<Estimate>(`/jobs/${jobId}/estimates`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['estimates', v.jobId] });
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export function useSendEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, channels }: { id: string; channels: string[] }) =>
      api.post(`/estimates/${id}/send`, { channels }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estimates'] }),
  });
}

export function useApproveEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; notes?: string; method?: string }) =>
      api.post(`/estimates/${id}/approve`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimates'] });
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export function useRejectEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; notes?: string }) =>
      api.post(`/estimates/${id}/reject`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['estimates'] }),
  });
}
