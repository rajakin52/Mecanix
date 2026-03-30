'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// --- Types ---

interface PriceGroupRule {
  id: string;
  price_group_id: string;
  part_category: string;
  markup_pct: number;
}

interface PriceGroup {
  id: string;
  name: string;
  description: string | null;
  default_markup_pct: number;
  is_active: boolean;
  rules: PriceGroupRule[];
  created_at: string;
}

interface PricingSettings {
  pricingMode: string;
  defaultMarkupPct: number;
  allowManualOverride: boolean;
  defaultCostMethod: string;
  minimumMarginPct: number;
}

interface ResolvedMarkup {
  markupPct: number;
  source: string;
}

// --- Price Groups ---

export function usePriceGroups() {
  return useQuery({
    queryKey: ['price-groups'],
    queryFn: () => api.get<PriceGroup[]>('/pricing/groups'),
  });
}

export function usePriceGroup(id: string) {
  return useQuery({
    queryKey: ['price-group', id],
    queryFn: () => api.get<PriceGroup>(`/pricing/groups/${id}`),
    enabled: !!id,
  });
}

export function useCreatePriceGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; defaultMarkupPct: number }) =>
      api.post<PriceGroup>('/pricing/groups', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-groups'] }),
  });
}

export function useUpdatePriceGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; defaultMarkupPct?: number; isActive?: boolean }) =>
      api.patch<PriceGroup>(`/pricing/groups/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-groups'] }),
  });
}

export function useDeletePriceGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/pricing/groups/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-groups'] }),
  });
}

// --- Price Group Rules ---

export function useAddPriceGroupRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, ...data }: { groupId: string; partCategory: string; markupPct: number }) =>
      api.post(`/pricing/groups/${groupId}/rules`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-groups'] }),
  });
}

export function useDeletePriceGroupRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => api.delete(`/pricing/rules/${ruleId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-groups'] }),
  });
}

// --- Resolve Markup ---

export function useResolveMarkup(customerId?: string, partCategory?: string) {
  const params = new URLSearchParams();
  if (customerId) params.set('customerId', customerId);
  if (partCategory) params.set('partCategory', partCategory);
  const qs = params.toString();

  return useQuery({
    queryKey: ['resolve-markup', customerId, partCategory],
    queryFn: () => api.get<ResolvedMarkup>(`/pricing/resolve${qs ? `?${qs}` : ''}`),
    enabled: !!customerId,
  });
}

// --- Pricing Settings ---

export function usePricingSettings() {
  return useQuery({
    queryKey: ['pricing-settings'],
    queryFn: () => api.get<PricingSettings>('/pricing/settings'),
  });
}

export function useUpdatePricingSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { pricingMode?: string; defaultMarkupPct?: number; allowManualOverride?: boolean; defaultCostMethod?: string; minimumMarginPct?: number }) =>
      api.patch<PricingSettings>('/pricing/settings', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-settings'] }),
  });
}

// --- Copy Rules Between Groups ---

export function useCopyGroupRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: string; targetId: string }) =>
      api.post(`/pricing/groups/${sourceId}/copy-to/${targetId}`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-groups'] }),
  });
}

// --- Bulk Operations ---

export function useBulkUpdateCategoryMarkup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { partCategory: string; markupPct: number }) =>
      api.post('/pricing/bulk-update-category', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['price-groups'] }),
  });
}

export function useBulkRecalculateSellPrices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { category?: string }) =>
      api.post('/pricing/bulk-recalculate-sell-prices', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parts'] }),
  });
}
