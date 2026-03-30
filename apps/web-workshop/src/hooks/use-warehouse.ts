'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: 'main' | 'new_stock' | 'scrap' | 'dead_stock' | 'returns' | 'consignment';
  address: string | null;
  branch_id: string | null;
  branch_name: string | null;
  is_default: boolean;
  notes: string | null;
  stock_items_count: number;
  created_at: string;
}

export interface WarehouseStock {
  id: string;
  part_id: string;
  part_number: string;
  description: string;
  category: string;
  quantity: number;
  unit_cost: number;
  warehouse_id: string;
  warehouse_name: string;
  location: string | null;
}

export interface PartStockEntry {
  warehouse_id: string;
  warehouse_name: string;
  warehouse_type: string;
  quantity: number;
  location: string | null;
}

export interface InventorySummary {
  total_skus: number;
  total_stock_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

export interface StockTransfer {
  id: string;
  transfer_number: string;
  from_warehouse_id: string;
  from_warehouse_name: string;
  to_warehouse_id: string;
  to_warehouse_name: string;
  status: 'draft' | 'in_transit' | 'completed' | 'cancelled';
  notes: string | null;
  lines: StockTransferLine[];
  created_at: string;
  completed_at: string | null;
}

export interface StockTransferLine {
  id: string;
  part_id: string;
  part_number: string;
  description: string;
  quantity: number;
}

export interface StockCount {
  id: string;
  count_number: string;
  warehouse_id: string;
  warehouse_name: string;
  status: 'draft' | 'in_progress' | 'completed' | 'approved';
  notes: string | null;
  counted_by: string | null;
  counted_by_name: string | null;
  lines_count: number;
  variance_count: number;
  created_at: string;
  completed_at: string | null;
}

export interface StockCountLine {
  id: string;
  part_id: string;
  part_number: string;
  description: string;
  system_qty: number;
  counted_qty: number | null;
  variance: number;
  notes: string | null;
}

export interface StockCountDetail extends StockCount {
  lines: StockCountLine[];
}

interface WarehousesResponse {
  data: Warehouse[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface WarehouseStockResponse {
  data: WarehouseStock[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface TransfersResponse {
  data: StockTransfer[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface StockCountsResponse {
  data: StockCount[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

// ── Warehouse Queries ──────────────────────────────────────────────────────

export function useWarehouses(page = 1) {
  return useQuery({
    queryKey: ['warehouses', page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      return api.get<WarehousesResponse>(`/warehouses?${params}`);
    },
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: ['warehouse', id],
    queryFn: () => api.get<Warehouse>(`/warehouses/${id}`),
    enabled: !!id,
  });
}

export function useWarehouseStock(warehouseId: string, page = 1) {
  return useQuery({
    queryKey: ['warehouse-stock', warehouseId, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      return api.get<WarehouseStockResponse>(`/warehouses/${warehouseId}/stock?${params}`);
    },
    enabled: !!warehouseId,
  });
}

export function usePartStock(partId: string) {
  return useQuery({
    queryKey: ['part-stock', partId],
    queryFn: () => api.get<PartStockEntry[]>(`/warehouses/part/${partId}/stock`),
    enabled: !!partId,
  });
}

export function useInventorySummary() {
  return useQuery({
    queryKey: ['inventory-summary'],
    queryFn: () => api.get<InventorySummary>('/warehouses/summary'),
  });
}

// ── Warehouse Mutations ────────────────────────────────────────────────────

export function useCreateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Warehouse>('/warehouses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      qc.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}

export function useUpdateWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.patch<Warehouse>(`/warehouses/${id}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      qc.invalidateQueries({ queryKey: ['warehouse', v.id] });
    },
  });
}

export function useDeleteWarehouse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/warehouses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warehouses'] });
      qc.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}

// ── Stock Transfer Queries & Mutations ─────────────────────────────────────

export function useStockTransfers(page = 1) {
  return useQuery({
    queryKey: ['stock-transfers', page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      return api.get<TransfersResponse>(`/stock-transfers?${params}`);
    },
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<StockTransfer>('/stock-transfers', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      qc.invalidateQueries({ queryKey: ['warehouse-stock'] });
      qc.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}

export function useCompleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<StockTransfer>(`/stock-transfers/${id}/complete`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-transfers'] });
      qc.invalidateQueries({ queryKey: ['warehouse-stock'] });
      qc.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}

// ── Stock Count Queries & Mutations ────────────────────────────────────────

export function useStockCounts(page = 1) {
  return useQuery({
    queryKey: ['stock-counts', page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      return api.get<StockCountsResponse>(`/stock-counts?${params}`);
    },
  });
}

export function useStockCount(id: string) {
  return useQuery({
    queryKey: ['stock-count', id],
    queryFn: () => api.get<StockCountDetail>(`/stock-counts/${id}`),
    enabled: !!id,
  });
}

export function useCreateStockCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<StockCount>('/stock-counts', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-counts'] });
    },
  });
}

export function useUpdateCountLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ countId, lineId, ...data }: { countId: string; lineId: string; counted_qty: number; notes?: string }) =>
      api.patch<StockCountLine>(`/stock-counts/${countId}/lines/${lineId}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['stock-count', v.countId] });
    },
  });
}

export function useApproveCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<StockCount>(`/stock-counts/${id}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-counts'] });
      qc.invalidateQueries({ queryKey: ['warehouse-stock'] });
      qc.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}
