'use client';

import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/use-debounce';
import { api } from '@/lib/api';

export interface CustomerDuplicate {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  tax_id: string | null;
  match_reason: 'phone' | 'email' | 'name';
  match_score: number;
}

export interface VehicleDuplicate {
  id: string;
  plate: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  customer: { id: string; full_name: string } | null;
  match_reason: 'plate' | 'vin';
  match_score: number;
}

export function useCustomerDuplicates(input: { phone?: string; email?: string; fullName?: string }) {
  const debounced = {
    phone: useDebounce(input.phone ?? '', 400),
    email: useDebounce(input.email ?? '', 400),
    fullName: useDebounce(input.fullName ?? '', 400),
  };

  return useQuery<CustomerDuplicate[]>({
    queryKey: ['customer-duplicates', debounced.phone, debounced.email, debounced.fullName],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (debounced.phone) qs.set('phone', debounced.phone);
      if (debounced.email) qs.set('email', debounced.email);
      if (debounced.fullName) qs.set('fullName', debounced.fullName);
      return api.get<CustomerDuplicate[]>(`/customers/find-duplicates?${qs}`);
    },
    enabled: Boolean(debounced.phone || debounced.email || (debounced.fullName && debounced.fullName.length >= 3)),
  });
}

export function useVehicleDuplicates(input: { plate?: string; vin?: string }) {
  const debounced = {
    plate: useDebounce(input.plate ?? '', 400),
    vin: useDebounce(input.vin ?? '', 400),
  };

  return useQuery<VehicleDuplicate[]>({
    queryKey: ['vehicle-duplicates', debounced.plate, debounced.vin],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (debounced.plate) qs.set('plate', debounced.plate);
      if (debounced.vin) qs.set('vin', debounced.vin);
      return api.get<VehicleDuplicate[]>(`/vehicles/find-duplicates?${qs}`);
    },
    enabled: Boolean(
      (debounced.plate && debounced.plate.length >= 3) ||
        (debounced.vin && debounced.vin.length >= 11),
    ),
  });
}
