'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface CommsRow {
  id: string;
  customer_id: string | null;
  job_card_id: string | null;
  invoice_id: string | null;
  channel: 'whatsapp' | 'sms' | 'push' | 'email';
  template_key: string;
  direction: 'inbound' | 'outbound';
  recipient: string | null;
  body: string | null;
  sent_at: string;
  delivery_status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
  delivery_error: string | null;
  metadata: Record<string, unknown>;
}

export function useCustomerComms(filters: { customerId?: string; jobCardId?: string; invoiceId?: string } = {}) {
  return useQuery<CommsRow[]>({
    queryKey: ['customer-comms', filters.customerId, filters.jobCardId, filters.invoiceId],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filters.customerId) qs.set('customerId', filters.customerId);
      if (filters.jobCardId) qs.set('jobCardId', filters.jobCardId);
      if (filters.invoiceId) qs.set('invoiceId', filters.invoiceId);
      const q = qs.toString();
      return api.get<CommsRow[]>(`/notifications/comms${q ? `?${q}` : ''}`);
    },
    enabled: Boolean(filters.customerId || filters.jobCardId || filters.invoiceId),
  });
}
