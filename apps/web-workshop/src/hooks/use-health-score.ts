'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface HealthScoreResult {
  score: number;
  updated_at: string;
  cached: boolean;
  components: {
    dvi: { value: number | null; weight: number };
    deferred_reds: { count: number; score: number; weight: number };
    comebacks_12m: { count: number; score: number; weight: number };
    days_since_service: { days: number | null; score: number; weight: number };
    active_warranty: { has_coverage: boolean; score: number; weight: number };
  };
}

export function useVehicleHealthScore(vehicleId: string) {
  return useQuery<HealthScoreResult>({
    queryKey: ['vehicle-health-score', vehicleId],
    queryFn: () => api.get<HealthScoreResult>(`/vehicles/${vehicleId}/health-score`),
    enabled: !!vehicleId,
    refetchOnWindowFocus: false,
  });
}

export function useRecomputeHealthScore(vehicleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<HealthScoreResult>(`/vehicles/${vehicleId}/health-score/recompute`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vehicle-health-score', vehicleId] }),
  });
}
