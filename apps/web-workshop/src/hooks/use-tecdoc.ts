'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTecDocSearch(make: string, model: string, year?: number) {
  return useQuery({
    queryKey: ['tecdoc-search', make, model, year],
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/tecdoc/search?make=${make}&model=${model}${year ? `&year=${year}` : ''}`),
    enabled: !!make && !!model,
  });
}

export function useTecDocVehicles(make: string) {
  return useQuery({
    queryKey: ['tecdoc-vehicles', make],
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/tecdoc/vehicles/${make}`),
    enabled: !!make,
  });
}
