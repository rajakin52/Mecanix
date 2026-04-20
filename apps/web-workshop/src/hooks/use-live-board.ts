'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface LiveBoardEntry {
  technician: { id: string; full_name: string; specializations: string[] };
  status: 'working' | 'paused' | 'idle' | 'off';
  clocked_in: boolean;
  clock_in_at: string | null;
  clock_out_at: string | null;
  today_clocked_hours: number;
  today_billed_hours: number;
  today_jobs_count: number;
  active_timer: {
    id: string;
    status: string;
    started_at: string;
    paused_at: string | null;
    total_seconds: number;
    job_card_id: string;
    job_number: string | null;
    vehicle_plate: string | null;
    bay_id: string | null;
    bay_name: string | null;
  } | null;
}

export function useLiveBoard() {
  return useQuery<LiveBoardEntry[]>({
    queryKey: ['tech-live-board'],
    queryFn: () => api.get<LiveBoardEntry[]>('/technicians/live-board'),
    refetchInterval: 10_000,
  });
}
