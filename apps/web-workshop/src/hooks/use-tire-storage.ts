'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type R = Record<string, unknown>;

interface CreateDto {
  customerId: string;
  vehicleId?: string;
  storageCode?: string;
  tireCount?: number;
  tireBrand?: string;
  tireModel?: string;
  tireSize?: string;
  season: 'summer' | 'winter' | 'all_season';
  treadDepthMm?: number;
  wheelIncluded?: boolean;
  notes?: string;
  monthlyFee?: number;
  currency?: string;
}

export function useTireStorage(filters: { status?: string; customerId?: string; vehicleId?: string } = {}) {
  return useQuery<R[]>({
    queryKey: ['tire-storage', filters.status, filters.customerId, filters.vehicleId],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filters.status) qs.set('status', filters.status);
      if (filters.customerId) qs.set('customerId', filters.customerId);
      if (filters.vehicleId) qs.set('vehicleId', filters.vehicleId);
      const q = qs.toString();
      return api.get<R[]>(`/tire-storage${q ? `?${q}` : ''}`);
    },
  });
}

export function useTireStorageSummary() {
  return useQuery<{ totalActive: number; fitted: number; returned: number; monthlyRevenue: number }>({
    queryKey: ['tire-storage', 'summary'],
    queryFn: () =>
      api.get<{ totalActive: number; fitted: number; returned: number; monthlyRevenue: number }>(
        '/tire-storage/summary',
      ),
  });
}

export function useCreateTireStorage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDto) => api.post<R>('/tire-storage', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tire-storage'] }),
  });
}

export function useChangeTireStorageStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string; status: 'stored' | 'fitted' | 'returned' | 'written_off'; notes?: string; jobCardId?: string }) =>
      api.post<R>(`/tire-storage/${id}/status`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tire-storage'] }),
  });
}
