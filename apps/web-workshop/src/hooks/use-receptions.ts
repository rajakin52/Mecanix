'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface DamagePoint {
  id?: string;
  body_zone: string;
  damage_type: string;
  severity: string;
  diagram_view: string;
  coordinate_x?: number;
  coordinate_y?: number;
  note?: string;
}

export interface ChecklistItem {
  id?: string;
  category: string;
  item_code?: string;
  item_label: string;
  status: string;
  detail?: string;
}

export interface Reception {
  id: string;
  job_card_id: string;
  vehicle_id: string;
  odometer_km: number;
  fuel_level: string;
  key_type: string | null;
  keys_received: number;
  reported_issues: string | null;
  symptom_codes: string[];
  signature_data: string | null;
  signature_method: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  completed: boolean;
  received_at: string;
  damage_points: DamagePoint[];
  photos: Array<Record<string, unknown>>;
  checklist_items: ChecklistItem[];
}

export function useReception(jobCardId: string) {
  return useQuery({
    queryKey: ['reception', jobCardId],
    queryFn: () => api.get<Reception | null>(`/receptions/job/${jobCardId}`),
    enabled: !!jobCardId,
  });
}

export function useCreateReception() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Reception>('/receptions', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reception'] });
    },
  });
}

export function useSignReception() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.post(`/receptions/${id}/sign`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reception'] });
    },
  });
}
