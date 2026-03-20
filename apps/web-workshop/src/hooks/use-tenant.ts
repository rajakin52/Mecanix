'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  country: string;
  currency: string;
  timezone: string;
  locale: string;
}

export function useTenant() {
  return useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get<Tenant>('/tenants/me'),
    staleTime: 1000 * 60 * 10, // 10 minutes — tenant data rarely changes
  });
}
