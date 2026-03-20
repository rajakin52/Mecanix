'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
}

interface ExpensesResponse {
  data: Expense[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface ExpenseSummary {
  total: number;
  by_category: Array<{ category: string; total: number }>;
}

export function useExpenses(page = 1, category?: string, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['expenses', page, category, startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (category) params.set('category', category);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      return api.get<ExpensesResponse>(`/expenses?${params}`);
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Expense>('/expenses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.patch<Expense>(`/expenses/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['expense-summary'] });
    },
  });
}

export function useExpenseSummary(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['expense-summary', startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString();
      return api.get<ExpenseSummary>(`/expenses/summary${qs ? `?${qs}` : ''}`);
    },
  });
}
