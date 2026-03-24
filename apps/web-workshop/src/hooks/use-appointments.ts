'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Appointment {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  vehicle_id: string | null;
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  service_type: string;
  description: string | null;
  technician_id: string | null;
  bay_number: number | null;
  status: string;
  job_card_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer?: { id: string; full_name: string } | null;
  vehicle?: { id: string; plate: string; make: string; model: string } | null;
  technician?: { id: string; full_name: string } | null;
}

export function useAppointments(date?: string, status?: string) {
  return useQuery({
    queryKey: ['appointments', date, status],
    queryFn: () => {
      const params = new URLSearchParams();
      if (date) params.set('date', date);
      if (status) params.set('status', status);
      const qs = params.toString();
      return api.get<Appointment[]>(`/appointments${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useAppointmentsByDate(date: string) {
  return useQuery({
    queryKey: ['appointments', 'date', date],
    queryFn: () => api.get<Appointment[]>(`/appointments/date/${date}`),
    enabled: !!date,
  });
}

export function useAvailableSlots(date: string, duration: number) {
  return useQuery({
    queryKey: ['appointments', 'slots', date, duration],
    queryFn: () => api.get<string[]>(`/appointments/slots/${date}?duration=${duration}`),
    enabled: !!date,
  });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Appointment>('/appointments', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useUpdateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.patch<Appointment>(`/appointments/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.post<Appointment>(`/appointments/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}
