'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DueService {
  schedule_id: string;
  service_name: string;
  interval_km: number | null;
  interval_months: number | null;
  estimated_hours: number | null;
  typical_parts: string[];
  notes: string | null;
  last_service_at: string | null;
  months_since_last: number;
  km_since_last: number | null;
  next_due_km: number | null;
  next_due_date: string | null;
  km_until_due: number | null;
  days_until_due: number | null;
  urgency: 'overdue' | 'soon' | 'upcoming';
}

export interface DueServicesResult {
  vehicle: { id: string; mileage: number };
  services: DueService[];
}

export function useVehicleDueServices(vehicleId: string) {
  return useQuery<DueServicesResult>({
    queryKey: ['vehicle-due-services', vehicleId],
    queryFn: () => api.get<DueServicesResult>(`/vehicles/${vehicleId}/due-services`),
    enabled: !!vehicleId,
  });
}
