'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface AiDiagnoseInput {
  reportedProblem: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear?: number;
}

interface ChatMessage {
  id: string;
  tenant_id: string;
  customer_phone: string;
  direction: 'inbound' | 'outbound';
  message: string;
  ai_generated: boolean;
  created_at: string;
}

export function useAiConfigured() {
  return useQuery({
    queryKey: ['ai-configured'],
    queryFn: () => api.get<{ configured: boolean }>('/ai/configured'),
  });
}

export function useAiRespond() {
  return useMutation({
    mutationFn: (data: { customerPhone: string; message: string }) =>
      api.post<{ reply: string }>('/ai/respond', data),
  });
}

export function useAiDiagnose() {
  return useMutation({
    mutationFn: (data: AiDiagnoseInput) =>
      api.post<{ suggestion: string }>('/ai/diagnose', data),
  });
}

export function useAiChatHistory(phone: string) {
  return useQuery({
    queryKey: ['ai-chat-history', phone],
    queryFn: () => api.get<ChatMessage[]>(`/ai/chat-history/${encodeURIComponent(phone)}`),
    enabled: !!phone,
  });
}
