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
  vat_by_rate?: Record<string, number>;
  vat_captive_pct?: number;
  iva_captive_amount?: number;
  service_retention_pct?: number;
  service_retention_amount?: number;
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
  customer?: { full_name: string; phone?: string; email?: string; tax_id?: string; address?: string } | null;
  customers?: { full_name: string; phone?: string; email?: string; tax_id?: string; address?: string } | null;
  job_card?: { id: string; job_number: string } | null;
  job_cards?: { id: string; job_number: string } | null;
  payments?: Array<Record<string, unknown>>;
  credit_notes?: Array<Record<string, unknown>>;
}

interface InvoicesResponse {
  data: Invoice[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function useInvoices(page = 1, status?: string, customerId?: string, search?: string) {
  return useQuery({
    queryKey: ['invoices', page, status, customerId, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (status) params.set('status', status);
      if (customerId) params.set('customerId', customerId);
      if (search && search.trim().length > 0) params.set('search', search.trim());
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
    mutationFn: (data: { jobCardId: string; customerPortion?: number; dueDate?: string; notes?: string; closeJobCard?: boolean }) =>
      api.post<Invoice>('/invoices/generate', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export interface StandaloneLine {
  partId?: string;
  description: string;
  quantity: number;
  unitCost?: number;
  sellPrice: number;
  taxCodeId?: string;
  discountPct?: number;
  discountAmount?: number;
}

export interface StandaloneInvoiceInput {
  customerId: string;
  lines: StandaloneLine[];
  dueDate?: string;
  notes?: string;
  discountPct?: number;
  discountAmount?: number;
  warehouseId?: string;
}

export function useCreateStandaloneInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: StandaloneInvoiceInput) =>
      api.post<Invoice>('/invoices/standalone', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['parts'] });
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

export function useCreatePaymentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      api.post<{ public_pay_token: string; public_pay_expires_at: string }>(
        `/invoices/${invoiceId}/payment-link`,
        {},
      ),
    onSuccess: (_d, invoiceId) => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useRevokePaymentLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) => api.delete(`/invoices/${invoiceId}/payment-link`),
    onSuccess: (_d, invoiceId) => {
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
    },
  });
}

export function useSendPaymentReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId: string) =>
      api.post<{ ok: boolean; reason: string; phone?: string }>(
        `/invoices/${invoiceId}/payment-reminder`,
        {},
      ),
    onSuccess: (_d, invoiceId) => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice', invoiceId] });
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

interface CreditAndRebillResult {
  credit_note: { id: string; credit_note_number: string };
  job_card_id: string;
  cloned_parts_count: number;
  cloned_labour_count: number;
}

export function useCreditAndRebill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
      api.post<CreditAndRebillResult>(`/invoices/${invoiceId}/credit-and-rebill`, { reason }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['invoice', v.invoiceId] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['job-cards'] });
    },
  });
}

export function useFinancialSummary() {
  return useQuery({
    queryKey: ['financial-summary'],
    queryFn: () => api.get<Record<string, unknown>>('/invoices/summary'),
  });
}
