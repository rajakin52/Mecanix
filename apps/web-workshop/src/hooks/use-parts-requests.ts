'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type PartsRequestStatus = 'requested' | 'picking' | 'ready' | 'issued' | 'cancelled';
export type PartsRequestPriority = 'normal' | 'urgent';

export interface PartsRequestItem {
  id: string;
  part_id: string;
  part_number: string;
  description: string;
  quantity_requested: number;
  quantity_picked: number;
  status: 'pending' | 'picked' | 'unavailable';
}

export interface PartsRequest {
  id: string;
  request_number: string;
  job_card_id: string;
  job_card_number: string;
  requested_by: string;
  requested_by_name: string;
  priority: PartsRequestPriority;
  status: PartsRequestStatus;
  notes: string | null;
  items: PartsRequestItem[];
  created_at: string;
  updated_at: string;
}

interface PartsRequestsResponse {
  data: PartsRequest[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

// ── Queries ────────────────────────────────────────────────────────────────

export function usePartsRequests(status?: string, jobCardId?: string, page = 1) {
  return useQuery({
    queryKey: ['parts-requests', status, jobCardId, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (status && status !== 'all') params.set('status', status);
      if (jobCardId) params.set('jobCardId', jobCardId);
      return api.get<PartsRequestsResponse>(`/parts-requests?${params}`);
    },
  });
}

export function usePartsRequest(id: string) {
  return useQuery({
    queryKey: ['parts-request', id],
    queryFn: () => api.get<PartsRequest>(`/parts-requests/${id}`),
    enabled: !!id,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useCreatePartsRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<PartsRequest>('/parts-requests', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts-requests'] });
    },
  });
}

export function useStartPicking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<PartsRequest>(`/parts-requests/${id}/pick`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['parts-requests'] });
      qc.invalidateQueries({ queryKey: ['parts-request', id] });
    },
  });
}

export function useMarkItemPicked() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, itemId, quantity_picked }: { requestId: string; itemId: string; quantity_picked?: number }) =>
      api.patch<PartsRequestItem>(`/parts-requests/${requestId}/items/${itemId}/picked`, { quantity_picked }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['parts-requests'] });
      qc.invalidateQueries({ queryKey: ['parts-request', v.requestId] });
    },
  });
}

export function useMarkItemUnavailable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, itemId }: { requestId: string; itemId: string }) =>
      api.patch<PartsRequestItem>(`/parts-requests/${requestId}/items/${itemId}/unavailable`, {}),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['parts-requests'] });
      qc.invalidateQueries({ queryKey: ['parts-request', v.requestId] });
    },
  });
}

export function useMarkReady() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<PartsRequest>(`/parts-requests/${id}/ready`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['parts-requests'] });
      qc.invalidateQueries({ queryKey: ['parts-request', id] });
    },
  });
}

export function useIssueParts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<PartsRequest>(`/parts-requests/${id}/issue`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['parts-requests'] });
      qc.invalidateQueries({ queryKey: ['parts-request', id] });
      qc.invalidateQueries({ queryKey: ['warehouse-stock'] });
      qc.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}

export function useCancelPartsRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<PartsRequest>(`/parts-requests/${id}/cancel`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['parts-requests'] });
      qc.invalidateQueries({ queryKey: ['parts-request', id] });
    },
  });
}
