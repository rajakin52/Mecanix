'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Campaign {
  id: string;
  name: string;
  message: string;
  target_type: string;
  target_filter: Record<string, unknown> | null;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

interface RecipientsResponse {
  recipients: Array<{ phone: string; full_name: string }>;
  count: number;
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.get<Campaign[]>('/marketing/campaigns'),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: () => api.get<Campaign>(`/marketing/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Campaign>('/marketing/campaigns', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useCampaignRecipients(id: string) {
  return useQuery({
    queryKey: ['campaign-recipients', id],
    queryFn: () => api.get<RecipientsResponse>(`/marketing/campaigns/${id}/recipients`),
    enabled: !!id,
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Campaign>(`/marketing/campaigns/${id}/send`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}
