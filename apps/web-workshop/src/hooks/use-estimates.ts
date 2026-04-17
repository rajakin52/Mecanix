'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Estimate {
  id: string;
  job_card_id: string | null;
  customer_id: string | null;
  vehicle_id: string | null;
  source: 'standalone' | 'job_card';
  converted_job_card_id: string | null;
  reported_problem: string | null;
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
  // Joined data from listAll
  customers?: { id: string; full_name: string; phone: string } | null;
  vehicles?: { id: string; plate: string; make: string; model: string } | null;
}

interface EstimatesListResponse {
  data: Estimate[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

// ── List all estimates (paginated) ──

export function useAllEstimates(page = 1, search = '', status?: string, source?: string) {
  return useQuery({
    queryKey: ['all-estimates', page, search, status, source],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      if (source) params.set('source', source);
      return api.get<EstimatesListResponse>(`/estimates?${params}`);
    },
  });
}

// ── List estimates for a specific job ──

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

// ── Create estimate from job card (existing flow) ──

export function useCreateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, ...data }: { jobId: string; terms?: string; validUntil?: string }) =>
      api.post<Estimate>(`/jobs/${jobId}/estimates`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['estimates', v.jobId] });
      qc.invalidateQueries({ queryKey: ['all-estimates'] });
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

// ── Create standalone estimate ──

export function useCreateStandaloneEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      customerId: string;
      vehicleId: string;
      reportedProblem?: string;
      labourLines: Array<{ description: string; hours: number; rate: number }>;
      partsLines: Array<{ partName: string; partNumber?: string; quantity: number; unitCost: number; markupPct?: number }>;
      isTaxable?: boolean;
      terms?: string;
      validUntil?: string;
    }) => api.post<Estimate>('/estimates/standalone', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-estimates'] }),
  });
}

// ── Update standalone estimate ──

export function useUpdateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch<Estimate>(`/estimates/${id}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['estimate', v.id] });
      qc.invalidateQueries({ queryKey: ['all-estimates'] });
    },
  });
}

// ── Convert estimate to job card ──

export function useConvertEstimateToJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; primaryTechnicianId?: string; symptomCodes?: string[]; reportedProblem?: string }) =>
      api.post<{ jobCard: { id: string; job_number: string }; estimateId: string }>(`/estimates/${id}/convert-to-job`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-estimates'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

// ── Send, Approve, Reject ──

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
      qc.invalidateQueries({ queryKey: ['all-estimates'] });
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
}

export function useRejectEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; notes?: string }) =>
      api.post(`/estimates/${id}/reject`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estimates'] });
      qc.invalidateQueries({ queryKey: ['all-estimates'] });
    },
  });
}
