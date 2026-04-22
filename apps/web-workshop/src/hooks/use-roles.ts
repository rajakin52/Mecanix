'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Capability {
  key: string;
  label: string;
  category: string;
  description: string | null;
}

export interface Role {
  id: string;
  tenant_id: string | null;
  key: string;
  label: string;
  description: string | null;
  is_system: boolean;
  capability_keys: string[];
}

export function useCapabilities() {
  return useQuery({
    queryKey: ['capabilities'],
    queryFn: () => api.get<Capability[]>('/tenants/me/capabilities'),
    staleTime: 1000 * 60 * 30, // 30 min — capability catalogue changes via migration only
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<Role[]>('/tenants/me/roles'),
    staleTime: 1000 * 60,
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { key: string; label: string; description?: string; capabilities: string[] }) =>
      api.post<{ id: string }>('/tenants/me/roles', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}

export function useUpdateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      ...body
    }: {
      roleId: string;
      label?: string;
      description?: string;
      capabilities?: string[];
    }) => api.patch<{ id: string }>(`/tenants/me/roles/${roleId}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      // Session capabilities may have changed if the user is on this role
      qc.invalidateQueries({ queryKey: ['session'] });
    },
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => api.delete<{ deleted: boolean }>(`/tenants/me/roles/${roleId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
    },
  });
}
