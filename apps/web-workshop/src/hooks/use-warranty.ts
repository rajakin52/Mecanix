'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface WarrantyCoverageRow {
  id: string;
  kind: 'parts' | 'labour';
  description: string;
  job_card_id: string;
  job_number: string | null;
  starts_at: string | null;
  warranty_months: number | null;
  warranty_km: number | null;
  expires_at: string | null;
  days_remaining: number | null;
  km_remaining: number | null;
  subtotal: number;
}

export interface ComebackCandidate {
  id: string;
  job_number: string;
  status: string;
  date_closed: string | null;
  created_at: string;
}

export interface WarrantyCoverage {
  active_coverage: WarrantyCoverageRow[];
  comeback_candidates: ComebackCandidate[];
  current_mileage: number | null;
}

export function useVehicleWarrantyCoverage(vehicleId: string) {
  return useQuery<WarrantyCoverage>({
    queryKey: ['vehicle-warranty', vehicleId],
    queryFn: () => api.get<WarrantyCoverage>(`/vehicles/${vehicleId}/warranty-coverage`),
    enabled: !!vehicleId,
  });
}
