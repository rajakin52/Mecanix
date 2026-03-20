'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTechnicianTimers(technicianId: string) {
  return useQuery({
    queryKey: ['time-entries', technicianId],
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/time/technician/${technicianId}`),
    enabled: !!technicianId,
  });
}

export function useActiveTimer(technicianId: string) {
  return useQuery({
    queryKey: ['active-timer', technicianId],
    queryFn: () => api.get<Record<string, unknown> | null>(`/time/active/${technicianId}`),
    enabled: !!technicianId,
    refetchInterval: 10000, // Poll every 10s for live updates
  });
}

export function useJobTimeEntries(jobId: string) {
  return useQuery({
    queryKey: ['job-time', jobId],
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/time/job/${jobId}`),
    enabled: !!jobId,
  });
}

export function useTechnicianStats(technicianId: string, date: string) {
  return useQuery({
    queryKey: ['tech-stats', technicianId, date],
    queryFn: () => api.get<Record<string, unknown>>(`/time/stats/${technicianId}?date=${date}`),
    enabled: !!technicianId,
  });
}

export function useStartTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { technicianId: string; jobCardId: string }) =>
      api.post('/time/start', data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['active-timer', v.technicianId] });
      qc.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });
}

export function usePauseTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/time/${id}/pause`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-timer'] }),
  });
}

export function useResumeTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/time/${id}/resume`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-timer'] }),
  });
}

export function useStopTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      api.post(`/time/${id}/stop`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-timer'] });
      qc.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });
}

export function useClockToday(technicianId: string) {
  return useQuery({
    queryKey: ['clock-today', technicianId],
    queryFn: () => api.get<Record<string, unknown> | null>(`/clock/today/${technicianId}`),
    enabled: !!technicianId,
  });
}

export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (technicianId: string) => api.post('/clock/in', { technicianId }),
    onSuccess: (_d, tid) => qc.invalidateQueries({ queryKey: ['clock-today', tid] }),
  });
}

export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (technicianId: string) => api.post('/clock/out', { technicianId }),
    onSuccess: (_d, tid) => qc.invalidateQueries({ queryKey: ['clock-today', tid] }),
  });
}
