'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Vehicle, CreateVehicleDto, UpdateVehicleDto, PaginationMeta } from '@mecanix/types';

interface VehiclesResponse {
  data: Vehicle[];
  meta: PaginationMeta;
}

export function useVehicles(page = 1, search = '', customerId?: string) {
  return useQuery({
    queryKey: ['vehicles', page, search, customerId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (customerId) params.set('customerId', customerId);
      return api.get<VehiclesResponse>(`/vehicles?${params}`);
    },
  });
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => api.get<Vehicle>(`/vehicles/${id}`),
    enabled: !!id,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVehicleDto) => api.post<Vehicle>('/vehicles', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdateVehicleDto & { id: string }) =>
      api.patch<Vehicle>(`/vehicles/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle', variables.id] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/vehicles/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
  });
}
