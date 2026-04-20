'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

type R = Record<string, unknown>;

export function useCreditNotesRegister() {
  return useQuery<R[]>({
    queryKey: ['credit-notes', 'register'],
    queryFn: () => api.get<R[]>('/credit-notes'),
  });
}
