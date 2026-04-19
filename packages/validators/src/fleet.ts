import { z } from 'zod';

export const createFleetSchema = z.object({
  name: z.string().min(2).max(200),
  companyName: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.string().email().max(200).optional().or(z.literal('')),
  customerId: z.string().uuid().optional(),
  monthlyBudget: z.coerce.number().min(0).optional(),
  notes: z.string().max(4000).optional(),
});

export const updateFleetSchema = createFleetSchema.partial();

export const fleetPmScheduleSchema = z.object({
  name: z.string().min(2).max(200),
  catalogId: z.string().uuid().optional(),
  mileageInterval: z.coerce.number().int().min(0).optional(),
  timeIntervalDays: z.coerce.number().int().min(0).optional(),
});

export type CreateFleetInput = z.infer<typeof createFleetSchema>;
export type UpdateFleetInput = z.infer<typeof updateFleetSchema>;
export type FleetPmScheduleInput = z.infer<typeof fleetPmScheduleSchema>;
