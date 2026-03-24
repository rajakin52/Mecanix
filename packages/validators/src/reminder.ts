import { z } from 'zod';

export const createReminderSchema = z.object({
  vehicleId: z.string().uuid(),
  customerId: z.string().uuid(),
  reminderType: z.enum(['mileage', 'date', 'both']),
  serviceName: z.string().min(1).max(200),
  nextMileage: z.coerce.number().int().min(0).optional(),
  mileageInterval: z.coerce.number().int().min(0).optional(),
  nextDate: z.string().optional(),
  dateIntervalDays: z.coerce.number().int().min(1).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateReminderSchema = createReminderSchema.partial();

export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
