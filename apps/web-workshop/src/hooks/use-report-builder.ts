'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ReportColumn {
  key: string;
  label: string;
  format?: 'currency' | 'integer' | 'date' | 'percent';
}

export interface ReportTemplate {
  type: string;
  name: string;
  description: string;
  filters: Array<{ key: string; label: string; type: 'date' | 'string' | 'branch' | 'job_type' }>;
  columns: ReportColumn[];
}

export interface SavedReport {
  id: string;
  name: string;
  description: string | null;
  report_type: string;
  filters: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useReportTemplates() {
  return useQuery<ReportTemplate[]>({
    queryKey: ['report-templates'],
    queryFn: () => api.get<ReportTemplate[]>('/report-builder/templates'),
  });
}

export function useSavedReports() {
  return useQuery<SavedReport[]>({
    queryKey: ['saved-reports'],
    queryFn: () => api.get<SavedReport[]>('/report-builder/saved'),
  });
}

export function useRunReport() {
  return useMutation({
    mutationFn: (data: { reportType: string; filters?: Record<string, unknown> }) =>
      api.post<{ rows: Array<Record<string, unknown>>; columns: ReportColumn[]; name: string }>(
        '/report-builder/run',
        data,
      ),
  });
}

export function useSaveReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; reportType: string; filters: Record<string, unknown> }) =>
      api.post<SavedReport>('/report-builder/saved', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-reports'] }),
  });
}

export function useDeleteSavedReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/report-builder/saved/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-reports'] }),
  });
}
