'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface LinePhoto {
  id: string;
  line_kind: 'parts' | 'labour';
  parts_line_id: string | null;
  labour_line_id: string | null;
  snapshot: 'before' | 'after';
  storage_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
}

export function useLinePhotos(jobId: string, lineKind: 'parts' | 'labour', lineId: string | null) {
  return useQuery<LinePhoto[]>({
    queryKey: ['line-photos', jobId, lineKind, lineId],
    queryFn: () => {
      if (!lineId) return Promise.resolve([] as LinePhoto[]);
      const qs = new URLSearchParams({ lineKind, lineId }).toString();
      return api.get<LinePhoto[]>(`/jobs/${jobId}/line-photos?${qs}`);
    },
    enabled: !!jobId && !!lineId,
  });
}

export function useUploadLinePhoto(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      lineKind: 'parts' | 'labour';
      partsLineId?: string;
      labourLineId?: string;
      snapshot: 'before' | 'after';
      base64Data?: string;
      storageUrl?: string;
      caption?: string;
    }) => api.post<LinePhoto>(`/jobs/${jobId}/line-photos`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['line-photos', jobId] }),
  });
}

export function useDeleteLinePhoto(jobId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (photoId: string) => api.delete(`/jobs/${jobId}/line-photos/${photoId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['line-photos', jobId] }),
  });
}
