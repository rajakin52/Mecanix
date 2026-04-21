'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ReorderSuggestion {
  part_id: string;
  part_number: string;
  description: string;
  category: string | null;
  stock_qty: number;
  reserved_qty: number;
  available: number;
  unit_cost: number;
  supplier_id: string | null;
  vendor: { id: string; name: string } | null;
  issued_last_90d: number;
  velocity_per_day: number;
  days_of_cover: number | null;
  suggested_qty: number;
  estimated_cost: number;
  priority: 'critical' | 'warning' | 'watch';
}

export function useReorderSuggestions() {
  return useQuery<ReorderSuggestion[]>({
    queryKey: ['reorder-suggestions'],
    queryFn: () => api.get<ReorderSuggestion[]>('/parts/reorder-suggestions'),
  });
}
