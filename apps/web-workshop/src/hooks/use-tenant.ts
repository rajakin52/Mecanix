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
  // Identity / billing
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  tax_id?: string | null;
  // Bank details printed on invoices
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_iban?: string | null;
  bank_swift?: string | null;
}

export function useTenant() {
  return useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get<Tenant>('/tenants/me'),
    staleTime: 1000 * 60 * 10, // 10 minutes — tenant data rarely changes
  });
}
