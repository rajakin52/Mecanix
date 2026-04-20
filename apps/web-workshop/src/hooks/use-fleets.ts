'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type R = Record<string, unknown>;

interface CreateFleetDto {
  name: string;
  companyName?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  customerId?: string;
  monthlyBudget?: number;
  notes?: string;
}

export function useFleets() {
  return useQuery<R[]>({
    queryKey: ['fleets'],
    queryFn: () => api.get<R[]>('/fleets'),
  });
}

export function useFleet(id: string) {
  return useQuery<R>({
    queryKey: ['fleet', id],
    queryFn: () => api.get<R>(`/fleets/${id}`),
    enabled: !!id,
  });
}

export function useFleetSpend(id: string) {
  return useQuery<R>({
    queryKey: ['fleet', id, 'spend'],
    queryFn: () => api.get<R>(`/fleets/${id}/spend`),
    enabled: !!id,
  });
}

export function useCreateFleet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFleetDto) => api.post<R>('/fleets', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fleets'] }),
  });
}

export function useUpdateFleet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<CreateFleetDto> & { id: string }) =>
      api.patch<R>(`/fleets/${id}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['fleets'] });
      qc.invalidateQueries({ queryKey: ['fleet', v.id] });
    },
  });
}

export function useAddVehicleToFleet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fleetId, vehicleId }: { fleetId: string; vehicleId: string }) =>
      api.post<R>(`/fleets/${fleetId}/vehicles/${vehicleId}`, {}),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['fleet', v.fleetId] });
      qc.invalidateQueries({ queryKey: ['fleets'] });
    },
  });
}

export function useRemoveVehicleFromFleet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fleetId, vehicleId }: { fleetId: string; vehicleId: string }) =>
      api.delete(`/fleets/${fleetId}/vehicles/${vehicleId}`),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['fleet', v.fleetId] });
      qc.invalidateQueries({ queryKey: ['fleets'] });
    },
  });
}
