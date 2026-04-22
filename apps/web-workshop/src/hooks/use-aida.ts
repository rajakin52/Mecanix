'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AssessmentStatus =
  | 'capturing'
  | 'analysing'
  | 'ready'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type ViewAngle =
  | 'front' | 'front_left' | 'front_right'
  | 'left' | 'right'
  | 'rear' | 'rear_left' | 'rear_right'
  | 'roof' | 'interior' | 'detail' | 'vin_plate' | 'odometer' | 'other';

export type DamageType =
  | 'dent' | 'scratch' | 'tear' | 'crack' | 'misalignment'
  | 'paint_blemish' | 'missing' | 'other';

export type Operation = 'replace' | 'repair' | 'paint' | 'blend' | 'r_and_i';

export interface AssessmentSummary {
  id: string;
  vehicle_id: string;
  job_card_id: string | null;
  claim_id: string | null;
  status: AssessmentStatus;
  source: 'manual' | 'aida_v0' | 'aida_v1';
  total_hours: number;
  total_parts_cost: number;
  total_paint_cost: number;
  total_estimate: number;
  confidence_avg: number | null;
  analysed_at: string | null;
  analysed_by_model: string | null;
  pushed_to_job_at: string | null;
  created_at: string;
  vehicle?: { id: string; plate: string; make: string; model: string; year: number | null };
  job_card?: { id: string; job_number: string } | null;
  claim?: { id: string; claim_number: string } | null;
}

export interface AssessmentPhoto {
  id: string;
  storage_path: string;
  public_url: string | null;
  thumbnail_url: string | null;
  view_angle: ViewAngle | null;
  panel_hint: string | null;
  width_px: number | null;
  height_px: number | null;
  uploaded_at: string;
}

export interface AssessmentFinding {
  id: string;
  panel: string;
  damage_type: DamageType;
  severity: number;
  area_pct: number | null;
  confidence: number | null;
  source: 'manual' | 'model' | 'reviewer_override';
  model_version: string | null;
  notes: string | null;
  photo_id: string | null;
}

export interface AssessmentOperation {
  id: string;
  finding_id: string | null;
  panel: string;
  operation: Operation;
  labour_hours: number;
  parts_cost: number;
  paint_cost: number;
  oem_part_number: string | null;
  source: 'manual' | 'model' | 'reviewer_override';
  notes: string | null;
}

export interface AssessmentDetail extends AssessmentSummary {
  photos: AssessmentPhoto[];
  findings: AssessmentFinding[];
  operations: AssessmentOperation[];
}

interface ListFilters {
  vehicleId?: string;
  jobCardId?: string;
  claimId?: string;
  status?: AssessmentStatus;
}

export interface AidaStats {
  analysesThisMonth: number;
  monthlyAnalysesMax: number;
  totalAnalyses: number;
  avgConfidence: number | null;
  editRate: number | null;
}

export function useAidaStats() {
  return useQuery({
    queryKey: ['aida-stats'],
    queryFn: () => api.get<AidaStats>('/aida/stats'),
    staleTime: 60_000,
  });
}

export function useAssessments(filters: ListFilters = {}) {
  const qs = new URLSearchParams();
  if (filters.vehicleId) qs.set('vehicleId', filters.vehicleId);
  if (filters.jobCardId) qs.set('jobCardId', filters.jobCardId);
  if (filters.claimId) qs.set('claimId', filters.claimId);
  if (filters.status) qs.set('status', filters.status);
  const params = qs.toString() ? `?${qs}` : '';
  return useQuery({
    queryKey: ['aida-assessments', filters],
    queryFn: () => api.get<AssessmentSummary[]>(`/aida/assessments${params}`),
  });
}

export function useAssessment(id: string | undefined) {
  return useQuery({
    queryKey: ['aida-assessment', id],
    queryFn: () => api.get<AssessmentDetail>(`/aida/assessments/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { vehicleId: string; jobCardId?: string; claimId?: string; branchId?: string }) =>
      api.post<AssessmentSummary>('/aida/assessments', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aida-assessments'] }),
  });
}

export function useUpdateAssessment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: { status?: AssessmentStatus; reviewNotes?: string }) =>
      api.patch(`/aida/assessments/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aida-assessment', id] });
      qc.invalidateQueries({ queryKey: ['aida-assessments'] });
    },
  });
}

export function useFinaliseAssessment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { approve: boolean; notes?: string }) =>
      api.post(`/aida/assessments/${id}/finalise`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aida-assessment', id] });
      qc.invalidateQueries({ queryKey: ['aida-assessments'] });
    },
  });
}

export function useAnalyseAssessment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ force }: { force?: boolean } = {}) =>
      api.post<AssessmentDetail>(`/aida/assessments/${id}/analyse${force ? '?force=true' : ''}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aida-assessment', id] });
      qc.invalidateQueries({ queryKey: ['aida-assessments'] });
    },
  });
}

export function useCreateJobFromAssessment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ jobId: string; jobNumber: string }>(`/aida/assessments/${id}/create-job`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aida-assessment', id] });
      qc.invalidateQueries({ queryKey: ['aida-assessments'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUploadAssessmentPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      file: string;
      filename: string;
      viewAngle?: ViewAngle;
      panelHint?: string;
    }) => api.post(`/aida/assessments/${id}/photos`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aida-assessment', id] }),
  });
}

export function useDeleteAssessmentPhoto(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => api.delete(`/aida/assessments/${id}/photos/${photoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aida-assessment', id] }),
  });
}

export function useAddFinding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      panel: string;
      damageType: DamageType;
      severity: number;
      areaPct?: number;
      notes?: string;
    }) => api.post(`/aida/assessments/${id}/findings`, { ...input, source: 'manual' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aida-assessment', id] }),
  });
}

export function useDeleteFinding(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (findingId: string) => api.delete(`/aida/assessments/${id}/findings/${findingId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aida-assessment', id] }),
  });
}

export function useAddOperation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      findingId?: string;
      panel: string;
      operation: Operation;
      labourHours: number;
      partsCost: number;
      paintCost: number;
      oemPartNumber?: string;
      notes?: string;
    }) => api.post(`/aida/assessments/${id}/operations`, { ...input, source: 'manual' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aida-assessment', id] }),
  });
}

export function useDeleteOperation(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opId: string) => api.delete(`/aida/assessments/${id}/operations/${opId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aida-assessment', id] }),
  });
}
