'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useTenant } from '@/hooks/use-tenant';

interface TenantContextValue {
  currency: string;
  secondaryCurrency: string | null;
  exchangeRate: number | null;
  country: string;
  locale: string;
  tenantName: string;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue>({
  currency: 'AOA',
  secondaryCurrency: null,
  exchangeRate: null,
  country: 'AO',
  locale: 'pt-PT',
  tenantName: '',
  isLoading: true,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const { data: tenant, isLoading } = useTenant();

  return (
    <TenantContext.Provider
      value={{
        currency: (tenant?.currency as string) ?? 'AOA',
        secondaryCurrency: (tenant?.secondary_currency as string) ?? null,
        exchangeRate: tenant?.exchange_rate ? Number(tenant.exchange_rate) : null,
        country: (tenant?.country as string) ?? 'AO',
        locale: (tenant?.locale as string) ?? 'pt-PT',
        tenantName: (tenant?.name as string) ?? '',
        isLoading,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext() {
  return useContext(TenantContext);
}
