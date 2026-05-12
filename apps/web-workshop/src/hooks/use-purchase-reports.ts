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

export interface PeriodValue { count: number; amount: number }
export interface PeriodMargin { revenue: number; cost: number; margin: number; margin_pct: number }

export interface InventoryDashboard {
  inventory: {
    total_parts: number;
    total_units: number;
    stock_value: number;
    consumables_value: number;
    low_stock_count: number;
    out_of_stock_count: number;
  };
  procurement: {
    purchases: { today: PeriodValue; week: PeriodValue; month: PeriodValue };
    received: { today: PeriodValue; week: PeriodValue; month: PeriodValue };
    pending: { count: number; value: number; overdue_count: number };
    top_vendors_mtd: Array<{ vendor_id: string; vendor_name: string; amount: number; count: number }>;
    outstanding_bills: { count: number; total: number };
  };
  consumption: {
    delivered: { today: PeriodValue; week: PeriodValue; month: PeriodValue; ytd: PeriodValue };
    margin: {
      issued: { today: PeriodMargin; week: PeriodMargin; month: PeriodMargin; ytd: PeriodMargin };
      invoiced: { today: PeriodMargin; week: PeriodMargin; month: PeriodMargin; ytd: PeriodMargin };
    };
    wip_value: number;
    top_parts_mtd: Array<{ part_number: string | null; description: string; quantity: number; revenue: number }>;
  };
  health: {
    backorder_count: number;
    slow_moving_value: number;
    stock_turnover: number;
  };
  generated_at: string;
}

export interface StockValuationRow {
  id: string;
  part_number: string | null;
  description: string;
  category: string | null;
  location: string | null;
  stock_qty: number;
  reserved_qty: number;
  available: number;
  unit_cost: number;
  sell_price: number;
  stock_value: number;
  potential_revenue: number;
  is_consumable: boolean;
  is_universal: boolean;
}
export interface StockValuationResponse {
  rows: StockValuationRow[];
  totals: { parts: number; units: number; value: number; potential_revenue: number };
}
export interface LowStockRow {
  id: string;
  part_number: string | null;
  description: string;
  category: string | null;
  location: string | null;
  stock_qty: number;
  reserved_qty: number;
  available: number;
  reorder_point: number;
  shortfall: number;
  out_of_stock: boolean;
  unit_cost: number;
  sell_price: number;
  vendor_name: string | null;
  replenish_value: number;
}
export interface LowStockResponse {
  rows: LowStockRow[];
  totals: { parts: number; out_of_stock: number; shortfall_units: number; replenish_value: number };
}
export function useLowStockDetail() {
  return useQuery({
    queryKey: ['reports', 'low-stock-detail'],
    queryFn: () => api.get<LowStockResponse>('/reports/low-stock-detail'),
  });
}

export function useStockValuation() {
  return useQuery({
    queryKey: ['reports', 'stock-valuation'],
    queryFn: () => api.get<StockValuationResponse>('/reports/stock-valuation'),
  });
}

export interface OutOfStockRow {
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
  vendor: { name: string } | null;
}
export function useOutOfStock() {
  return useQuery({
    queryKey: ['reports', 'out-of-stock'],
    queryFn: () => api.get<{ rows: OutOfStockRow[]; totals: { parts: number } }>('/reports/out-of-stock'),
  });
}

export interface BackorderRow {
  id: string;
  part_number: string | null;
  description: string;
  category: string | null;
  stock_qty: number;
  reserved_qty: number;
  available: number;
  reorder_point: number;
  unit_cost: number;
  sell_price: number;
}
export function useBackorders() {
  return useQuery({
    queryKey: ['reports', 'backorders'],
    queryFn: () => api.get<{ rows: BackorderRow[]; totals: { parts: number } }>('/reports/backorders'),
  });
}

export interface DeliveredRow {
  id: string;
  issued_at: string;
  part_number: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  sell_price: number;
  subtotal: number;
  margin: number;
  job_number: string | null;
  job_status: string | null;
  customer_name: string | null;
  vehicle_plate: string | null;
}
export interface DeliveredResponse {
  rows: DeliveredRow[];
  totals: { lines: number; quantity: number; revenue: number; cost: number; margin: number };
}
export function usePartsDelivered(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reports', 'parts-delivered', startDate, endDate],
    queryFn: () => api.get<DeliveredResponse>(`/reports/parts-delivered?startDate=${startDate}&endDate=${endDate}`),
  });
}

export interface MarginDetailRow {
  part_number: string | null;
  description: string;
  quantity: number;
  revenue: number;
  cost: number;
  margin: number;
  margin_pct: number;
}
export interface MarginDetailResponse {
  rows: MarginDetailRow[];
  totals: { items: number; quantity: number; revenue: number; cost: number; margin: number; margin_pct: number };
  mode: 'issued' | 'invoiced';
}
export function useMarginDetail(mode: 'issued' | 'invoiced', startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reports', 'margin-detail', mode, startDate, endDate],
    queryFn: () => api.get<MarginDetailResponse>(`/reports/margin-detail?mode=${mode}&startDate=${startDate}&endDate=${endDate}`),
  });
}

export function useInventoryDashboard() {
  return useQuery({
    queryKey: ['reports', 'inventory-dashboard'],
    queryFn: () => api.get<InventoryDashboard>('/reports/inventory-dashboard'),
    refetchInterval: 60_000, // refresh every minute
  });
}

export function useAbcAnalysis(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['reports', 'abc', startDate, endDate],
    queryFn: () =>
      api.get<AbcResponse>(`/reports/abc-analysis?startDate=${startDate}&endDate=${endDate}`),
  });
}
