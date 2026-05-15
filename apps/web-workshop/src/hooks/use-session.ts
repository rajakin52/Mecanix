'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SessionProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'manager' | 'receptionist' | 'technician';
  tenant_id: string;
  phone: string | null;
  avatar_url: string | null;
  preferred_language: 'en' | 'pt-PT' | 'pt-BR' | null;
  is_active: boolean;
  is_super_admin: boolean;
  home_tenant_id: string;
  current_tenant_id: string;
  is_impersonating: boolean;
  /** Effective capability keys for this user. ['*'] for super-admins. */
  capabilities: string[];
}

export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: () => api.get<SessionProfile>('/auth/profile'),
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Pure helper — returns true when the session holds the capability.
 * Use it in `useCan('settings.tenant')` style checks so UI components
 * don't have to know about super-admin wildcard etc.
 */
export function useCan(capability: string): boolean {
  const { data } = useSession();
  if (!data) return false;
  if (data.capabilities.includes('*')) return true;
  return data.capabilities.includes(capability);
}

export interface AdminTenantRow {
  id: string;
  name: string;
  country: string;
  currency: string;
  created_at: string;
}

/**
 * Super-admin only: list every tenant on the platform for the switcher.
 * Guarded by `enabled` so it only runs when we know the caller is a
 * super admin — otherwise we'd waste a 403 on every page load.
 */
export function useAllTenants(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-tenants'],
    queryFn: () => api.get<AdminTenantRow[]>('/tenants/admin/all'),
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}
