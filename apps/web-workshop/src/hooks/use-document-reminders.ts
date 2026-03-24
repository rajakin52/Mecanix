'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface DocumentReminder {
  id: string;
  vehicle_id: string | null;
  customer_id: string | null;
  document_type: string;
  document_name: string;
  expiry_date: string;
  reminder_days: number;
  status: 'active' | 'reminded' | 'renewed' | 'expired';
  notes: string | null;
  created_at: string;
  vehicle: { id: string; plate: string; make: string; model: string } | null;
  customer: { id: string; full_name: string } | null;
}

interface CreateDocumentReminderDto {
  vehicleId?: string;
  customerId?: string;
  documentType: string;
  documentName: string;
  expiryDate: string;
  reminderDays?: number;
  notes?: string;
}

export function useDocumentReminders(vehicleId?: string, status?: string) {
  return useQuery({
    queryKey: ['document-reminders', vehicleId, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (vehicleId) params.set('vehicleId', vehicleId);
      if (status) params.set('status', status);
      const qs = params.toString();
      return api.get<DocumentReminder[]>(`/document-reminders${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useDueDocumentReminders() {
  return useQuery({
    queryKey: ['document-reminders', 'due'],
    queryFn: () => api.get<DocumentReminder[]>('/document-reminders/due'),
  });
}

export function useCreateDocumentReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDocumentReminderDto) =>
      api.post<DocumentReminder>('/document-reminders', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-reminders'] });
    },
  });
}

export function useRenewDocumentReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<DocumentReminder>(`/document-reminders/${id}/renew`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-reminders'] });
    },
  });
}
