'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Reminder {
  id: string;
  vehicle_id: string;
  customer_id: string;
  reminder_type: 'mileage' | 'date' | 'both';
  service_name: string;
  next_mileage: number | null;
  mileage_interval: number | null;
  next_date: string | null;
  date_interval_days: number | null;
  status: 'active' | 'sent' | 'completed' | 'cancelled';
  last_sent_at: string | null;
  notes: string | null;
  created_at: string;
  vehicles: { plate: string; make: string; model: string; mileage?: number } | null;
  customers: { full_name: string; phone: string } | null;
}

interface CreateReminderDto {
  vehicleId: string;
  customerId: string;
  reminderType: 'mileage' | 'date' | 'both';
  serviceName: string;
  nextMileage?: number;
  mileageInterval?: number;
  nextDate?: string;
  dateIntervalDays?: number;
  notes?: string;
}

export function useReminders(vehicleId?: string, status?: string) {
  return useQuery<Reminder[]>({
    queryKey: ['reminders', vehicleId, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (vehicleId) params.set('vehicleId', vehicleId);
      if (status) params.set('status', status);
      const qs = params.toString();
      return api.get<Reminder[]>(`/reminders${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useVehicleReminders(vehicleId: string) {
  return useQuery<Reminder[]>({
    queryKey: ['reminders', 'vehicle', vehicleId],
    queryFn: () => api.get<Reminder[]>(`/reminders/vehicle/${vehicleId}`),
    enabled: !!vehicleId,
  });
}

export function useDueReminders() {
  return useQuery<Reminder[]>({
    queryKey: ['reminders', 'due'],
    queryFn: () => api.get<Reminder[]>('/reminders/due'),
  });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateReminderDto) => api.post<Reminder>('/reminders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CreateReminderDto> & { id: string }) =>
      api.patch<Reminder>(`/reminders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useMarkReminderSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Reminder>(`/reminders/${id}/send`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<Reminder>(`/reminders/${id}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    },
  });
}
