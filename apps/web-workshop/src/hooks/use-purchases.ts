'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// --- Vendors ---

interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  lead_time_days: number | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
}

interface VendorsResponse {
  data: Vendor[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function useVendors(search?: string) {
  return useQuery({
    queryKey: ['vendors', search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const qs = params.toString();
      return api.get<VendorsResponse>(`/vendors${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Vendor>('/vendors', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendors'] }),
  });
}

// --- Purchase Orders ---

interface PurchaseOrderLine {
  id: string;
  part_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  received_qty: number;
  subtotal: number;
}

interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  vendor_name?: string;
  vendor?: { id: string; name: string } | null;
  status: string;
  order_date: string;
  expected_date: string | null;
  total_amount?: number;
  total?: number;
  notes: string | null;
  lines?: PurchaseOrderLine[];
  created_at: string;
}

interface PurchaseOrdersResponse {
  data: PurchaseOrder[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function usePurchaseOrders(page = 1, vendorId?: string, status?: string) {
  return useQuery({
    queryKey: ['purchase-orders', page, vendorId, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (vendorId) params.set('vendorId', vendorId);
      if (status) params.set('status', status);
      return api.get<PurchaseOrdersResponse>(`/purchase-orders?${params}`);
    },
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ['purchase-order', id],
    queryFn: () => api.get<PurchaseOrder>(`/purchase-orders/${id}`),
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<PurchaseOrder>('/purchase-orders', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  });
}

export function useReceiveGoods() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; lines: Array<{ lineId: string; receivedQty: number }> }) =>
      api.post(`/purchase-orders/${id}/receive`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['purchase-order', v.id] });
      qc.invalidateQueries({ queryKey: ['parts'] });
    },
  });
}

// --- Bills ---

interface Bill {
  id: string;
  bill_number: string;
  vendor_id: string;
  vendor_name: string;
  purchase_order_id: string | null;
  amount: number;
  paid_amount: number;
  status: string;
  due_date: string;
  notes: string | null;
  created_at: string;
}

interface BillsResponse {
  data: Bill[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function useBills(page = 1, vendorId?: string, status?: string) {
  return useQuery({
    queryKey: ['bills', page, vendorId, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (vendorId) params.set('vendorId', vendorId);
      if (status) params.set('status', status);
      return api.get<BillsResponse>(`/bills?${params}`);
    },
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Bill>('/bills', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; amount: number; method?: string; reference?: string }) =>
      api.post(`/bills/${id}/pay`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  });
}
