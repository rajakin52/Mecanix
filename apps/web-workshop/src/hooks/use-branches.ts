'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
}

export interface StockByBranchGroup {
  branch_id: string | null;
  branch_name: string;
  branch_code: string | null;
  total: number;
  warehouses: Array<{
    warehouse_id: string;
    warehouse_name: string;
    warehouse_code: string;
    bin_location: string | null;
    quantity: number;
    min_quantity: number;
  }>;
}

export function useBranches() {
  return useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get<Branch[]>('/branches'),
  });
}

export function useMyBranches() {
  return useQuery<{ branches: Branch[]; primaryBranchId: string | null }>({
    queryKey: ['branches', 'me'],
    queryFn: () =>
      api.get<{ branches: Branch[]; primaryBranchId: string | null }>('/branches/me'),
  });
}

export function useStockByBranch(partId: string) {
  return useQuery<StockByBranchGroup[]>({
    queryKey: ['branches', 'stock-by-part', partId],
    queryFn: () => api.get<StockByBranchGroup[]>(`/branches/stock-by-part?partId=${partId}`),
    enabled: !!partId,
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      code: string;
      address?: string;
      phone?: string;
      email?: string;
      isDefault?: boolean;
      notes?: string;
    }) => api.post<Branch>('/branches', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
}

export function useUpdateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Branch> & { id: string; isDefault?: boolean }) =>
      api.patch<Branch>(`/branches/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
  });
}

export function useTransferStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      partId: string;
      fromWarehouseId: string;
      toWarehouseId: string;
      quantity: number;
      notes?: string;
    }) => api.post<{ transferred: number }>('/branches/transfer-stock', data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['branches', 'stock-by-part', v.partId] });
      qc.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}
