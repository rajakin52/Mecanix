'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { StandaloneLine } from './use-invoices';

export interface Proforma {
  id: string;
  proforma_number: string;
  customer_id: string;
  status: 'draft' | 'sent' | 'accepted' | 'expired' | 'cancelled' | 'converted';
  issue_date: string;
  valid_until: string | null;
  parts_total: number;
  subtotal: number;
  tax_amount: number;
  grand_total: number;
  vat_by_rate?: Record<string, number>;
  notes: string | null;
  footer: string | null;
  pdf_url: string | null;
  converted_invoice_id: string | null;
  converted_at: string | null;
  sent_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  customer?: { id: string; full_name: string; phone?: string | null };
  lines?: Array<{
    id: string;
    part_id: string | null;
    part_number: string | null;
    part_name: string;
    quantity: number;
    unit_cost: number;
    sell_price: number;
    subtotal: number;
    tax_rate: number;
    tax_code_id: string | null;
  }>;
}

interface ProformasResponse {
  data: Proforma[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function useProformas(page = 1, status?: string, customerId?: string) {
  return useQuery({
    queryKey: ['proformas', page, status, customerId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (status) params.set('status', status);
      if (customerId) params.set('customerId', customerId);
      return api.get<ProformasResponse>(`/proformas?${params}`);
    },
  });
}

export function useProforma(id: string | undefined) {
  return useQuery({
    queryKey: ['proforma', id],
    queryFn: () => api.get<Proforma>(`/proformas/${id}`),
    enabled: !!id,
  });
}

export interface CreateProformaInput {
  customerId: string;
  lines: StandaloneLine[];
  validUntil?: string;
  notes?: string;
}

export function useCreateProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProformaInput) => api.post<Proforma>('/proformas', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['proformas'] }),
  });
}

export function useUpdateProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<CreateProformaInput>) =>
      api.patch<Proforma>(`/proformas/${id}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['proformas'] });
      qc.invalidateQueries({ queryKey: ['proforma', v.id] });
    },
  });
}

export function useSendProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Proforma>(`/proformas/${id}/send`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['proformas'] });
      qc.invalidateQueries({ queryKey: ['proforma', id] });
    },
  });
}

export function useCancelProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<Proforma>(`/proformas/${id}/cancel`, { reason }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['proformas'] });
      qc.invalidateQueries({ queryKey: ['proforma', v.id] });
    },
  });
}

export function useConvertProforma() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ id: string; invoice_number: string }>(`/proformas/${id}/convert`, {}),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['proformas'] });
      qc.invalidateQueries({ queryKey: ['proforma', id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}
