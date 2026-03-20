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
  vehicles?: { plate: string; make: string; model: string };
  customers?: { full_name: string; phone: string };
  technicians?: { full_name: string } | null;
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
