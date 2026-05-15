'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Customer, CreateCustomerDto, UpdateCustomerDto, PaginationMeta } from '@mecanix/types';

interface CustomersResponse {
  data: Customer[];
  meta: PaginationMeta;
}

export function useCustomers(page = 1, search = '') {
  return useQuery({
    queryKey: ['customers', page, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      return api.get<CustomersResponse>(`/customers?${params}`);
    },
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<Customer>(`/customers/${id}`),
    enabled: !!id,
  });
}

export interface CustomerLtv {
  customer_id: string;
  customer_since: string;
  invoice_count: number;
  first_invoice_date: string | null;
  last_invoice_date: string | null;
  days_since_last_visit: number | null;
  lifetime_revenue: number;
  lifetime_paid: number;
  outstanding_balance: number;
  lifetime_parts_revenue: number;
  lifetime_labour_revenue: number;
  credit_notes_total: number;
  parts_revenue: number;
  parts_cost: number;
  parts_margin: number;
  parts_margin_pct: number;
  parts_line_count: number;
  average_invoice_value: number;
}

export function useCustomerLtv(id: string) {
  return useQuery({
    queryKey: ['customer-ltv', id],
    queryFn: () => api.get<CustomerLtv>(`/customers/${id}/ltv`),
    enabled: !!id,
    staleTime: 60_000,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomerDto) => api.post<Customer>('/customers', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCustomerDto & { id: string }) =>
      api.patch<Customer>(`/customers/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}
