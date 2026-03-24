'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface GatePass {
  id: string;
  pass_number: string;
  job_card_id: string;
  vehicle_id: string;
  customer_id: string;
  pass_type: string;
  mileage: number | null;
  authorized_by: string | null;
  notes: string | null;
  issued_at: string;
  vehicle?: { id: string; plate: string; make: string; model: string };
  customer?: { id: string; full_name: string };
  authorizer?: { id: string; full_name: string } | null;
}

export function useGatePasses(jobCardId?: string) {
  return useQuery({
    queryKey: ['gate-passes', jobCardId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (jobCardId) params.set('jobCardId', jobCardId);
      return api.get<GatePass[]>(`/gate-passes?${params}`);
    },
    enabled: !!jobCardId,
  });
}

export function useGatePass(id: string) {
  return useQuery({
    queryKey: ['gate-pass', id],
    queryFn: () => api.get<GatePass>(`/gate-passes/${id}`),
    enabled: !!id,
  });
}

export function useCreateGatePass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<GatePass>('/gate-passes', data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['gate-passes', v.jobCardId] });
    },
  });
}
