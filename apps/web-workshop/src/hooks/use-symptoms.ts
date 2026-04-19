'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SymptomCode {
  id: string;
  code: string;
  label_en: string;
  label_pt: string;
  family: 'quick_service' | 'mechanic' | 'body_paint';
  category: string;
  icon: string | null;
  usage_count: number;
}

export function useSymptoms(family?: string, search?: string) {
  return useQuery({
    queryKey: ['symptoms', family, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (family) params.set('family', family);
      if (search) params.set('search', search);
      const qs = params.toString();
      return api.get<SymptomCode[]>(`/symptoms${qs ? `?${qs}` : ''}`);
    },
    enabled: !!family,
    staleTime: 10 * 60 * 1000, // symptoms are reference data, barely change
  });
}
