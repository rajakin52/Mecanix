'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type R = Record<string, unknown>;

interface CreateWebhookDto {
  name: string;
  url: string;
  secret?: string;
  events: string[];
}

export function useWebhooks() {
  return useQuery<R[]>({
    queryKey: ['webhooks'],
    queryFn: () => api.get<R[]>('/webhooks'),
  });
}

export function useWebhookLogs(id: string) {
  return useQuery<R[]>({
    queryKey: ['webhooks', id, 'logs'],
    queryFn: () => api.get<R[]>(`/webhooks/${id}/logs`),
    enabled: !!id,
  });
}

export function useCreateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWebhookDto) => api.post<R>('/webhooks', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useUpdateWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CreateWebhookDto & { is_active: boolean }> & { id: string }) =>
      api.patch<R>(`/webhooks/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}

export function useDeleteWebhook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
  });
}
