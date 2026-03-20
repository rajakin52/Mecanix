import { z } from 'zod';

export const startTimerSchema = z.object({
  technicianId: z.string().uuid(),
  jobCardId: z.string().uuid(),
});

export const stopTimerSchema = z.object({
  notes: z.string().max(2000).optional(),
});

export const clockInSchema = z.object({
  technicianId: z.string().uuid(),
});

export const clockOutSchema = z.object({
  technicianId: z.string().uuid(),
});

export type StartTimerInput = z.infer<typeof startTimerSchema>;
export type StopTimerInput = z.infer<typeof stopTimerSchema>;
export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
