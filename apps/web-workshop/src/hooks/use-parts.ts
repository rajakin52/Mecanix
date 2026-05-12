'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PartCompatibilityRow {
  id?: string;
  make: string;
  model: string | null;
  year_from: number | null;
  year_to: number | null;
}

interface Part {
  id: string;
  part_number: string;
  description: string;
  category: string;
  stock_qty: number;
  reorder_point: number;
  unit_cost: number;
  sell_price: number;
  location: string | null;
  created_at: string;
  tax_code_id: string | null;
  tax_code?: { id: string; code: string; rate: number } | null;
  is_universal?: boolean;
  compatibility?: PartCompatibilityRow[];
}

export interface PartsVehicleScope {
  make?: string;
  model?: string;
  year?: number;
}

export interface ResolvedVehicle {
  make: string | null;
  model: string | null;
  year: number | null;
  source: string;
}

interface PartsResponse {
  data: Part[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface LowStockResponse {
  data: Part[];
  count: number;
}

export function useParts(
  page = 1,
  search = '',
  category?: string,
  vehicle?: PartsVehicleScope,
  consumable?: boolean,
) {
  const scope = vehicle?.make ? vehicle : undefined;
  return useQuery({
    queryKey: ['parts', page, search, category, scope?.make, scope?.model, scope?.year, consumable],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (consumable) params.set('consumable', 'true');
      if (scope?.make) params.set('make', scope.make);
      if (scope?.model) params.set('model', scope.model);
      if (scope?.year) params.set('year', String(scope.year));
      return api.get<PartsResponse>(`/parts?${params}`);
    },
  });
}

export function useVehicleMakes() {
  return useQuery({
    queryKey: ['parts', 'vehicle-makes'],
    queryFn: () => api.get<string[]>('/parts/vehicle-makes'),
  });
}

export function useVehicleModels(make?: string) {
  return useQuery({
    queryKey: ['parts', 'vehicle-models', make],
    queryFn: () => api.get<string[]>(`/parts/vehicle-models?make=${encodeURIComponent(make ?? '')}`),
    enabled: !!make && make.trim().length > 0,
  });
}

export interface PartPurchaseHistoryRow {
  po_line_id: string;
  po_id: string;
  po_number: string;
  order_date: string;
  expected_date: string | null;
  status: string;
  vendor_id: string | null;
  vendor_name: string | null;
  quantity: number;
  unit_cost: number;
  received_qty: number;
}

export interface PartPurchaseHistory {
  history: PartPurchaseHistoryRow[];
  lastReceived: PartPurchaseHistoryRow | null;
  last: PartPurchaseHistoryRow | null;
}

export function usePartPurchaseHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['part', 'purchase-history', id],
    queryFn: () => api.get<PartPurchaseHistory>(`/parts/${id}/purchase-history`),
    enabled: !!id,
  });
}

export function useVehiclePlates() {
  return useQuery({
    queryKey: ['vehicles', 'plates'],
    queryFn: () => api.get<string[]>('/vehicles/plates'),
  });
}

export function useJobNumbers() {
  return useQuery({
    queryKey: ['jobs', 'numbers'],
    queryFn: () => api.get<string[]>('/jobs/numbers'),
  });
}

export interface CataloguePart {
  id: string;
  part_number: string | null;
  description: string;
  category: string | null;
  location: string | null;
  stock_qty: number;
  reorder_point: number;
  unit_cost: number;
  sell_price: number;
  is_universal: boolean;
  vendor: { name: string } | null;
  tax_code: { code: string; rate: number } | null;
  compatibility: Array<{ make: string; model: string | null; year_from: number | null; year_to: number | null }>;
}

export function useExportParts() {
  return useMutation({
    mutationFn: () => api.get<CataloguePart[]>('/parts/export'),
  });
}

export function useResolveVehicle() {
  return useMutation({
    mutationFn: async (args: { plate?: string; jobNumber?: string; jobCardId?: string }) => {
      const params = new URLSearchParams();
      if (args.plate) params.set('plate', args.plate);
      if (args.jobNumber) params.set('jobNumber', args.jobNumber);
      if (args.jobCardId) params.set('jobCardId', args.jobCardId);
      return api.get<ResolvedVehicle | null>(`/parts/resolve-vehicle?${params}`);
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
