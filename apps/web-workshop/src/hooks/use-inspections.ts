'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useInspection(jobCardId: string) {
  return useQuery({
    queryKey: ['inspection', jobCardId],
    queryFn: () => api.get<Record<string, unknown> | null>(`/inspections/job/${jobCardId}`),
    enabled: !!jobCardId,
  });
}

export function useCreateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/inspections', data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['inspection'] });
    },
  });
}

export function useUpdateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.patch(`/inspections/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspection'] });
    },
  });
}
