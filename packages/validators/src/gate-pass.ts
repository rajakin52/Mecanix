import { z } from 'zod';

export const createGatePassSchema = z.object({
  jobCardId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  customerId: z.string().uuid(),
  passType: z.enum(['entry', 'exit']).default('exit'),
  mileage: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export type CreateGatePassInput = z.infer<typeof createGatePassSchema>;
