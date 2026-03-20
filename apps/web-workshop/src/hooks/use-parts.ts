'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Part {
  id: string;
  part_number: string;
  description: string;
  category: string;
  stock_on_hand: number;
  reorder_point: number;
  cost_price: number;
  sell_price: number;
  location: string | null;
  created_at: string;
}

interface PartsResponse {
  data: Part[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface LowStockResponse {
  data: Part[];
  count: number;
}

export function useParts(page = 1, search = '', category?: string) {
  return useQuery({
    queryKey: ['parts', page, search, category],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      return api.get<PartsResponse>(`/parts?${params}`);
    },
  });
}

export function usePart(id: string) {
  return useQuery({
    queryKey: ['part', id],
    queryFn: () => api.get<Part>(`/parts/${id}`),
    enabled: !!id,
  });
}

export function useCreatePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Part>('/parts', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parts'] }),
  });
}

export function useUpdatePart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.patch<Part>(`/parts/${id}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['parts'] });
      qc.invalidateQueries({ queryKey: ['part', v.id] });
    },
  });
}

export function useLowStock() {
  return useQuery({
    queryKey: ['parts', 'low-stock'],
    queryFn: () => api.get<LowStockResponse>('/parts/low-stock'),
  });
}

export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; adjustment: number; reason?: string }) =>
      api.post(`/parts/${id}/adjust`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}
