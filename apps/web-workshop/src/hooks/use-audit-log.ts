'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user: { id: string; full_name?: string; email?: string } | null;
}

export function useAuditLog(filters: {
  action?: string;
  entityType?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
} = {}) {
  return useQuery<AuditLogRow[]>({
    queryKey: ['audit-log', filters],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (filters.action) qs.set('action', filters.action);
      if (filters.entityType) qs.set('entityType', filters.entityType);
      if (filters.userId) qs.set('userId', filters.userId);
      if (filters.startDate) qs.set('startDate', filters.startDate);
      if (filters.endDate) qs.set('endDate', filters.endDate);
      const q = qs.toString();
      return api.get<AuditLogRow[]>(`/audit-log${q ? `?${q}` : ''}`);
    },
  });
}

export function useAuditActions() {
  return useQuery<string[]>({
    queryKey: ['audit-log', 'actions'],
    queryFn: () => api.get<string[]>('/audit-log/actions'),
  });
}
