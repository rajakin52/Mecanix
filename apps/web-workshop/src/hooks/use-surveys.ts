'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface SurveySummary {
  nps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
  averageRating: number | null;
  responseCount: number;
  recentResponses?: Array<Record<string, unknown>>;
}

export function useSurveySummary(startDate?: string, endDate?: string) {
  return useQuery<SurveySummary>({
    queryKey: ['surveys', 'summary', startDate, endDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const qs = params.toString();
      return api.get<SurveySummary>(`/surveys/summary${qs ? `?${qs}` : ''}`);
    },
  });
}
