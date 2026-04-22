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

export interface VehicleHistoryJob {
  id: string;
  job_number: string;
  status: string;
  created_at: string;
  date_closed: string | null;
  job_type: 'mechanical' | 'body_repair';
  labour_total: number;
  parts_total: number;
  grand_total: number;
  reported_problem: string | null;
  labels: string[];
  customer: { id: string; full_name: string } | null;
  primary_technician: { id: string; full_name: string } | null;
  parts_lines: Array<{
    id: string;
    part_name: string;
    part_number: string | null;
    quantity: number;
    sell_price: number;
    subtotal: number;
  }>;
}

export interface VehicleHistoryPart {
  part_name: string;
  part_number: string | null;
  last_installed: string;
  install_count: number;
  jobs: string[];
}

export interface VehicleHistory {
  jobs: VehicleHistoryJob[];
  parts_history: VehicleHistoryPart[];
  cost_summary: {
    total_spent: number;
    labour_total: number;
    parts_total: number;
    job_count: number;
    by_category: Record<string, { labour: number; parts: number; total: number; count: number }>;
  };
}

export function useVehicleHistory(id: string | undefined) {
  return useQuery({
    queryKey: ['vehicle-history', id],
    queryFn: () => api.get<VehicleHistory>(`/vehicles/${id}/history`),
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
