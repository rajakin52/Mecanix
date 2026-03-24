'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  country: string;
  currency: string;
  secondary_currency: string | null;
  exchange_rate: number | null;
  exchange_rate_updated_at: string | null;
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
