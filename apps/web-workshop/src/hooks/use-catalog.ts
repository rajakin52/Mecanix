'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface CatalogLabourItem {
  id: string;
  description: string;
  hours: number;
  rate: number;
}

interface CatalogPartsItem {
  id: string;
  part_id: string | null;
  part_name: string;
  part_number: string | null;
  quantity: number;
  unit_cost: number;
  markup_pct: number;
}

export interface CatalogItem {
  id: string;
  type: string;
  code: string | null;
  name: string;
  description: string | null;
  category: string | null;
  estimated_hours: number | null;
  fixed_price: number | null;
  quick_access: boolean;
  is_active: boolean;
  labour_items: CatalogLabourItem[];
  parts_items: CatalogPartsItem[];
  created_at: string;
}

export function useCatalogItems(type?: string, category?: string, quickAccessOnly?: boolean, search?: string) {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (category) params.set('category', category);
  if (quickAccessOnly) params.set('quickAccess', 'true');
  if (search) params.set('search', search);
  const qs = params.toString();

  return useQuery({
    queryKey: ['catalog', type, category, quickAccessOnly, search],
    queryFn: () => api.get<CatalogItem[]>(`/catalog${qs ? `?${qs}` : ''}`),
  });
}

export function useCatalogItem(id: string) {
  return useQuery({
    queryKey: ['catalog', id],
    queryFn: () => api.get<CatalogItem>(`/catalog/${id}`),
    enabled: !!id,
  });
}

export function useCatalogCategories() {
  return useQuery({
    queryKey: ['catalog-categories'],
    queryFn: () => api.get<string[]>('/catalog/categories'),
  });
}

export function useCreateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<CatalogItem>('/catalog', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog'] }),
  });
}

export function useUpdateCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.patch<CatalogItem>(`/catalog/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog'] }),
  });
}

export function useDeleteCatalogItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/catalog/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog'] }),
  });
}

export function useApplyCatalogToJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ catalogId, jobId }: { catalogId: string; jobId: string }) =>
      api.post(`/catalog/${catalogId}/apply-to-job/${jobId}`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      qc.invalidateQueries({ queryKey: ['job'] });
    },
  });
}
