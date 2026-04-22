'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface JobCard {
  id: string;
  job_number: string;
  status: string;
  vehicle_id: string;
  customer_id: string;
  reported_problem: string;
  internal_notes: string;
  labels: string[];
  is_insurance: boolean;
  is_taxable: boolean;
  labour_total: number;
  parts_total: number;
  tax_amount: number;
  grand_total: number;
  estimated_completion: string | null;
  date_opened: string;
  date_closed: string | null;
  primary_technician_id: string | null;
  created_at: string;
  vehicle?: { id: string; plate: string; make: string; model: string } | null;
  customer?: { id: string; full_name: string; phone: string } | null;
  vehicles?: { id: string; plate: string; make: string; model: string } | null;
  customers?: { id: string; full_name: string; phone: string } | null;
  technicians?: { id: string; full_name: string } | null;
  vehicle_receptions?: Array<{ signed_by_name: string | null; contact_phone: string | null }> | null;
}

interface JobsResponse {
  data: JobCard[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function useJobs(page = 1, search = '', status?: string) {
  return useQuery({
    queryKey: ['jobs', page, search, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      return api.get<JobsResponse>(`/jobs?${params}`);
    },
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => api.get<JobCard>(`/jobs/${id}`),
    enabled: !!id,
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<JobCard>('/jobs', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
  });
}

export function useUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      api.post(`/jobs/${id}/status`, { status, notes }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job', v.id] });
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch<JobCard>(`/jobs/${id}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job', v.id] });
    },
  });
}

export function useConvertJobType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, jobType }: { id: string; jobType: 'mechanical' | 'body_repair' }) =>
      api.post<JobCard>(`/jobs/${id}/convert-type`, { jobType }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job', v.id] });
    },
  });
}

export function useTechnicians() {
  return useQuery({
    queryKey: ['technicians'],
    queryFn: () => api.get<Array<{ id: string; full_name: string; specializations: string[]; hourly_rate: number }>>('/technicians'),
  });
}

// Labour lines
export function useLabourLines(jobId: string) {
  return useQuery({
    queryKey: ['labour-lines', jobId],
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/jobs/${jobId}/labour-lines`),
    enabled: !!jobId,
  });
}

export function useCreateLabourLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, ...data }: Record<string, unknown> & { jobId: string }) =>
      api.post(`/jobs/${jobId}/labour-lines`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['labour-lines', v.jobId] });
      qc.invalidateQueries({ queryKey: ['job', v.jobId] });
    },
  });
}

// Parts lines
export function usePartsLines(jobId: string) {
  return useQuery({
    queryKey: ['parts-lines', jobId],
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/jobs/${jobId}/parts-lines`),
    enabled: !!jobId,
  });
}

export function useCreatePartsLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, ...data }: Record<string, unknown> & { jobId: string }) =>
      api.post(`/jobs/${jobId}/parts-lines`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['parts-lines', v.jobId] });
      qc.invalidateQueries({ queryKey: ['job', v.jobId] });
    },
  });
}

export function useUpdateLabourLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, lineId, ...data }: Record<string, unknown> & { jobId: string; lineId: string }) =>
      api.patch(`/jobs/${jobId}/labour-lines/${lineId}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['labour-lines', v.jobId] });
      qc.invalidateQueries({ queryKey: ['job', v.jobId] });
    },
  });
}

export function useUpdatePartsLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, lineId, ...data }: Record<string, unknown> & { jobId: string; lineId: string }) =>
      api.patch(`/jobs/${jobId}/parts-lines/${lineId}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['parts-lines', v.jobId] });
      qc.invalidateQueries({ queryKey: ['job', v.jobId] });
    },
  });
}

export function useJobQc(jobId: string) {
  return useQuery({
    queryKey: ['job-qc', jobId],
    queryFn: () => api.get<Record<string, unknown> | null>(`/jobs/${jobId}/qc`),
    enabled: !!jobId,
  });
}

export function useUpsertJobQc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, ...data }: Record<string, unknown> & { jobId: string }) =>
      api.put(`/jobs/${jobId}/qc`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['job-qc', v.jobId] });
      qc.invalidateQueries({ queryKey: ['job', v.jobId] });
    },
  });
}

export function useJobBodyStages(jobId: string) {
  return useQuery({
    queryKey: ['job-body-stages', jobId],
    queryFn: () => api.get<Record<string, unknown> | null>(`/jobs/${jobId}/body-stages`),
    enabled: !!jobId,
  });
}

export function useUpsertJobBodyStages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, ...data }: Record<string, unknown> & { jobId: string }) =>
      api.put(`/jobs/${jobId}/body-stages`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['job-body-stages', v.jobId] });
    },
  });
}

export function useRecordPickupSignature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, ...data }: { jobId: string; signatureDataUrl: string; signedName: string; mileageOut?: number }) =>
      api.post(`/jobs/${jobId}/pickup-signature`, data),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['job', v.jobId] }),
  });
}

export function useChargeLabourLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, lineId }: { jobId: string; lineId: string }) =>
      api.post(`/jobs/${jobId}/labour-lines/${lineId}/charge`, {}),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['labour-lines', v.jobId] });
      qc.invalidateQueries({ queryKey: ['job', v.jobId] });
    },
  });
}

export function useChargePartsLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, lineId }: { jobId: string; lineId: string }) =>
      api.post(`/jobs/${jobId}/parts-lines/${lineId}/charge`, {}),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['parts-lines', v.jobId] });
      qc.invalidateQueries({ queryKey: ['job', v.jobId] });
    },
  });
}
