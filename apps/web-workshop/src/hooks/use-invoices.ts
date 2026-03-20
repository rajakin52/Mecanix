'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Invoice {
  id: string;
  invoice_number: string;
  job_card_id: string;
  customer_id: string;
  status: string;
  labour_total: number;
  parts_total: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  is_insurance: boolean;
  customer_portion: number | null;
  insurance_portion: number | null;
  invoice_date: string;
  due_date: string | null;
  notes: string | null;
  pdf_url: string | null;
  created_at: string;
  customers?: { full_name: string };
  job_cards?: { job_number: string };
  payments?: Array<Record<string, unknown>>;
  credit_notes?: Array<Record<string, unknown>>;
}

interface InvoicesResponse {
  data: Invoice[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function useInvoices(page = 1, status?: string, customerId?: string) {
  return useQuery({
    queryKey: ['invoices', page, status, customerId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (status) params.set('status', status);
      if (customerId) params.set('customerId', customerId);
      return api.get<InvoicesResponse>(`/invoices?${params}`);
    },
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<Invoice>(`/invoices/${id}`),
    enabled: !!id,
  });
}

export function useGenerateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobCardId: string; customerPortion?: number; dueDate?: string; notes?: string }) =>
      api.post<Invoice>('/invoices/generate', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useMarkAsSent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      api.post(`/invoices/${invoiceId}/send`, {}),
    onSuccess: (_d, invoiceId) => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...data }: { invoiceId: string; amount: number; paymentMethod: string; reference?: string; notes?: string }) =>
      api.post(`/invoices/${invoiceId}/payments`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['invoice', v.invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useCreateCreditNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, ...data }: { invoiceId: string; amount: number; reason: string }) =>
      api.post(`/invoices/${invoiceId}/credit-notes`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['invoice', v.invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useFinancialSummary() {
  return useQuery({
    queryKey: ['financial-summary'],
    queryFn: () => api.get<Record<string, unknown>>('/invoices/summary'),
  });
}
