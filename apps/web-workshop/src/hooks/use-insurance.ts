'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useInsuranceCompanies() {
  return useQuery({
    queryKey: ['insurance-companies'],
    queryFn: () => api.get<Array<Record<string, unknown>>>('/insurance/companies'),
  });
}

export function useCreateInsuranceCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/insurance/companies', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance-companies'] }),
  });
}

export function useUpdateInsuranceCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, unknown>) =>
      api.patch(`/insurance/companies/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance-companies'] }),
  });
}

export function useClaims(page = 1, status?: string) {
  return useQuery({
    queryKey: ['claims', page, status],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (status) params.set('status', status);
      return api.get<{ data: Array<Record<string, unknown>>; meta: Record<string, number> }>(`/insurance/claims?${params}`);
    },
  });
}

export function useClaim(id: string) {
  return useQuery({
    queryKey: ['claim', id],
    queryFn: () => api.get<Record<string, unknown>>(`/insurance/claims/${id}`),
    enabled: !!id,
  });
}

export function useInitiateClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobCardId: string; insuranceCompanyId: string; policyNumber?: string; excessAmount?: number }) =>
      api.post('/insurance/claims', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claims'] });
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateClaim(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: {
      jobCardId?: string | null;
      policyNumber?: string | null;
      excessAmount?: number;
    }) => api.patch(`/insurance/claims/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['claim', id] });
      qc.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

export function useChangeClaimStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; status: string; notes?: string }) =>
      api.post(`/insurance/claims/${id}/status`, data),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['claim', v.id] });
      qc.invalidateQueries({ queryKey: ['claims'] });
    },
  });
}

export function useCreateEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (claimId: string) => api.post(`/insurance/claims/${claimId}/estimates`, {}),
    onSuccess: (_d, claimId) => qc.invalidateQueries({ queryKey: ['claim', claimId] }),
  });
}

export function useEstimate(id: string) {
  return useQuery({
    queryKey: ['estimate', id],
    queryFn: () => api.get<Record<string, unknown>>(`/insurance/estimates/${id}`),
    enabled: !!id,
  });
}

export function useApproveEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; assessorName: string; notes?: string }) =>
      api.post(`/insurance/estimates/${id}/approve`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['claims'] }),
  });
}

// ── Claim packets ──────────────────────────────────────────────

export interface ClaimPacket {
  id: string;
  claim_id: string;
  storage_path: string;
  public_url: string | null;
  file_size: number;
  submitted_at: string | null;
  submitted_to: string | null;
  submitted_via: 'email' | 'api' | 'manual_portal' | null;
  response_at: string | null;
  response_status: 'acknowledged' | 'approved' | 'rejected' | 'supplement_requested' | null;
  response_notes: string | null;
  generated_at: string;
}

export function useClaimPackets(claimId: string) {
  return useQuery<ClaimPacket[]>({
    queryKey: ['claim-packets', claimId],
    queryFn: () => api.get<ClaimPacket[]>(`/insurance/claims/${claimId}/packets`),
    enabled: !!claimId,
  });
}

export function useGenerateClaimPacket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (claimId: string) =>
      api.post<ClaimPacket>(`/insurance/claims/${claimId}/packets`, {}),
    onSuccess: (_d, claimId) => {
      qc.invalidateQueries({ queryKey: ['claim-packets', claimId] });
      qc.invalidateQueries({ queryKey: ['claim', claimId] });
    },
  });
}

export function useSubmitClaimPacket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      claimId,
      packetId,
      channel,
      recipient,
    }: {
      claimId: string;
      packetId: string;
      channel: 'email' | 'api' | 'manual_portal';
      recipient?: string;
    }) =>
      api.post<{ packet: ClaimPacket; recipient: string | null }>(
        `/insurance/claims/${claimId}/packets/${packetId}/submit`,
        { channel, recipient },
      ),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['claim-packets', v.claimId] });
      qc.invalidateQueries({ queryKey: ['claim', v.claimId] });
    },
  });
}

export function useRecordPacketResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      claimId,
      packetId,
      status,
      notes,
    }: {
      claimId: string;
      packetId: string;
      status: 'acknowledged' | 'approved' | 'rejected' | 'supplement_requested';
      notes?: string;
    }) =>
      api.post<ClaimPacket>(
        `/insurance/claims/${claimId}/packets/${packetId}/response`,
        { status, notes },
      ),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['claim-packets', v.claimId] }),
  });
}
