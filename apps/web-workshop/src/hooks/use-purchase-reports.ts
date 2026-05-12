'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PartsPurchasedLine {
  source: 'po' | 'bill';
  date: string;
  document: string;
  vendor_name: string | null;
  part_id: string | null;
  part_number: string | null;
  description: string;
  quantity: number;
  received_qty: number;
  unit_cost: number;
  total: number;
}

export interface PartsPurchasedResponse {
  lines: PartsPurchasedLine[];
  totals: { line_count: number; quantity: number; value: number };
}

export function usePartsPurchased(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reports', 'parts-purchased', startDate, endDate],
    queryFn: () =>
      api.get<PartsPurchasedResponse>(
        `/reports/parts-purchased?startDate=${startDate}&endDate=${endDate}`,
      ),
  });
}

export interface PendingDeliveryRow {
  po_id: string;
  po_number: string;
  po_status: string;
  order_date: string;
  expected_date: string | null;
  overdue: boolean;
  vendor_name: string | null;
  part_number: string | null;
  description: string;
  quantity: number;
  received_qty: number;
  outstanding: number;
  unit_cost: number;
  outstanding_value: number;
}
export interface PendingDeliveriesResponse {
  rows: PendingDeliveryRow[];
  totals: { lines: number; outstanding_qty: number; outstanding_value: number; overdue_lines: number };
}

export function usePendingDeliveries() {
  return useQuery({
    queryKey: ['reports', 'pending-deliveries'],
    queryFn: () => api.get<PendingDeliveriesResponse>('/reports/pending-deliveries'),
  });
}

export interface ConsumableRow {
  id: string;
  part_number: string | null;
  description: string;
  category: string | null;
  location: string | null;
  stock_qty: number;
  reserved_qty: number;
  reorder_point: number;
  unit_cost: number;
  sell_price: number;
  available: number;
  below_reorder: boolean;
  stock_value: number;
}
export interface ConsumablesStockResponse {
  rows: ConsumableRow[];
  totals: { parts: number; units: number; value: number; below_reorder: number };
}

export function useConsumablesStock() {
  return useQuery({
    queryKey: ['reports', 'consumables-stock'],
    queryFn: () => api.get<ConsumablesStockResponse>('/reports/consumables-stock'),
  });
}

export interface SlowMovingRow {
  id: string;
  part_number: string | null;
  description: string;
  category: string | null;
  stock_qty: number;
  unit_cost: number;
  sell_price: number;
  created_at: string;
  tied_up_value: number;
}
export interface SlowMovingResponse {
  rows: SlowMovingRow[];
  totals: { parts: number; units: number; value: number };
  since: string;
}

export function useSlowMoving(days = 180) {
  return useQuery({
    queryKey: ['reports', 'slow-moving', days],
    queryFn: () => api.get<SlowMovingResponse>(`/reports/slow-moving?days=${days}`),
  });
}

export interface AbcRow {
  rank: number;
  part_number: string | null;
  description: string;
  quantity: number;
  revenue: number;
  revenue_pct: number;
  cumulative_pct: number;
  class: 'A' | 'B' | 'C';
}
export interface AbcResponse {
  rows: AbcRow[];
  summary: {
    total_revenue: number;
    total_items: number;
    class_A: { items: number; revenue: number };
    class_B: { items: number; revenue: number };
    class_C: { items: number; revenue: number };
  };
}

export function useAbcAnalysis(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reports', 'abc', startDate, endDate],
    queryFn: () =>
      api.get<AbcResponse>(`/reports/abc-analysis?startDate=${startDate}&endDate=${endDate}`),
  });
}
