'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  service_interest: string | null;
  vehicle_info: string | null;
  estimated_value: number | null;
  notes: string | null;
  assigned_to: string | null;
  next_follow_up: string | null;
  customer_id: string | null;
  created_at: string;
  assigned_user?: { id: string; full_name: string } | null;
  activities?: Activity[];
}

interface Activity {
  id: string;
  lead_id: string | null;
  customer_id: string | null;
  activity_type: string;
  description: string;
  outcome: string | null;
  performed_at: string;
  performer?: { id: string; full_name: string } | null;
}

interface LeadsResponse {
  data: Lead[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export function useLeads(page = 1, search = '', status?: string) {
  return useQuery({
    queryKey: ['leads', page, search, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      return api.get<LeadsResponse>(`/crm/leads?${params}`);
    },
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get<Lead>(`/crm/leads/${id}`),
    enabled: !!id,
  });
}

export function useDueFollowUps() {
  return useQuery({
    queryKey: ['leads-follow-ups'],
    queryFn: () => api.get<Lead[]>('/crm/leads/follow-ups'),
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post<Lead>('/crm/leads', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });
}

export function useUpdateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.patch<Lead>(`/crm/leads/${id}`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead', v.id] });
    },
  });
}

export function useChangeLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.post(`/crm/leads/${id}/status`, { status }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['lead', v.id] });
      qc.invalidateQueries({ queryKey: ['leads-follow-ups'] });
    },
  });
}

export function useConvertLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/crm/leads/${id}/convert`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
    },
  });
}

export function useActivities(leadId?: string, customerId?: string) {
  return useQuery({
    queryKey: ['activities', leadId, customerId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (leadId) params.set('leadId', leadId);
      if (customerId) params.set('customerId', customerId);
      return api.get<Activity[]>(`/crm/activities?${params}`);
    },
    enabled: !!(leadId || customerId),
  });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.post<Activity>('/crm/activities', data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['activities'] });
      if (v.leadId) {
        qc.invalidateQueries({ queryKey: ['lead', v.leadId] });
        qc.invalidateQueries({ queryKey: ['leads-follow-ups'] });
      }
    },
  });
}
