'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export type PurchaseRequestStatus = 'pending_approval' | 'approved' | 'rejected' | 'ordered' | 'received';

export interface PurchaseRequestItem {
  id: string;
  part_id: string;
  part_number: string;
  description: string;
  quantity: number;
  estimated_unit_cost: number;
  estimated_total: number;
}

export interface PurchaseRequest {
  id: string;
  pr_number: string;
  job_card_id: string | null;
  job_card_number: string | null;
  parts_request_id: string | null;
  status: PurchaseRequestStatus;
  estimated_total: number;
  notes: string | null;
  approved_by: string | null;
  approved_by_name: string | null;
  rejected_reason: string | null;
  po_id: string | null;
  po_number: string | null;
  items: PurchaseRequestItem[];
  created_at: string;
  updated_at: string;
}

interface PurchaseRequestsResponse {
  data: PurchaseRequest[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

// ── Queries ────────────────────────────────────────────────────────────────

export function usePurchaseRequests(status?: string, page = 1) {
  return useQuery({
    queryKey: ['purchase-requests', status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (status && status !== 'all') params.set('status', status);
      return api.get<PurchaseRequestsResponse>(`/purchase-requests?${params}`);
    },
  });
}

export function usePurchaseRequest(id: string) {
  return useQuery({
    queryKey: ['purchase-request', id],
    queryFn: () => api.get<PurchaseRequest>(`/purchase-requests/${id}`),
    enabled: !!id,
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useCreatePurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<PurchaseRequest>('/purchase-requests', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-requests'] });
    },
  });
}

export function useApprovePurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<PurchaseRequest>(`/purchase-requests/${id}/approve`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['purchase-requests'] });
      qc.invalidateQueries({ queryKey: ['purchase-request', id] });
    },
  });
}

export function useRejectPurchaseRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<PurchaseRequest>(`/purchase-requests/${id}/reject`, { reason }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['purchase-requests'] });
      qc.invalidateQueries({ queryKey: ['purchase-request', v.id] });
    },
  });
}

export function useLinkPO() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, po_id }: { id: string; po_id: string }) =>
      api.patch<PurchaseRequest>(`/purchase-requests/${id}/link-po`, { po_id }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['purchase-requests'] });
      qc.invalidateQueries({ queryKey: ['purchase-request', v.id] });
    },
  });
}

export function useMarkPRReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<PurchaseRequest>(`/purchase-requests/${id}/receive`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['purchase-requests'] });
      qc.invalidateQueries({ queryKey: ['purchase-request', id] });
      qc.invalidateQueries({ queryKey: ['warehouse-stock'] });
      qc.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}
