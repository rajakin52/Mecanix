import { z } from 'zod';

export const createAmcPackageSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  durationMonths: z.coerce.number().int().min(1).default(12),
  price: z.coerce.number().min(0),
  services: z.array(z.string()).default([]),
  maxVisits: z.coerce.number().int().min(1).optional(),
});

export const updateAmcPackageSchema = createAmcPackageSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createAmcSubscriptionSchema = z.object({
  packageId: z.string().uuid(),
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

export type CreateAmcPackageInput = z.infer<typeof createAmcPackageSchema>;
export type UpdateAmcPackageInput = z.infer<typeof updateAmcPackageSchema>;
export type CreateAmcSubscriptionInput = z.infer<typeof createAmcSubscriptionSchema>;
