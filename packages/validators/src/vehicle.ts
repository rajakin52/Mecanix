import { z } from 'zod';

export const createVehicleSchema = z.object({
  customerId: z.string().uuid(),
  plate: z.string().min(2).max(20).transform((v) => v.toUpperCase().replace(/\s/g, '')),
  vin: z.string().max(17).optional(),
  make: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(2100).optional(),
  color: z.string().max(50).optional(),
  fuelType: z.enum(['petrol', 'diesel', 'electric', 'hybrid', 'lpg']).optional(),
  engineSize: z.string().max(20).optional(),
  mileage: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().omit({ customerId: true }).extend({
  customerId: z.string().uuid().optional(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
