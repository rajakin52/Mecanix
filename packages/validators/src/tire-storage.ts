import { z } from 'zod';

export const createTireStorageSchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid().optional(),
  storageCode: z.string().max(100).optional(),
  tireCount: z.coerce.number().int().min(1).max(20).default(4),
  tireBrand: z.string().max(100).optional(),
  tireModel: z.string().max(100).optional(),
  tireSize: z.string().max(50).optional(),
  season: z.enum(['summer', 'winter', 'all_season']),
  treadDepthMm: z.coerce.number().min(0).max(20).optional(),
  wheelIncluded: z.boolean().optional(),
  photoUrls: z.array(z.string().url().max(2000)).max(12).optional(),
  notes: z.string().max(2000).optional(),
  monthlyFee: z.coerce.number().min(0).default(0),
  currency: z.string().max(10).optional(),
});

export const updateTireStorageSchema = createTireStorageSchema.partial();

export const changeTireStorageStatusSchema = z.object({
  status: z.enum(['stored', 'fitted', 'returned', 'written_off']),
  notes: z.string().max(2000).optional(),
  jobCardId: z.string().uuid().optional(),
});

export type CreateTireStorageInput = z.infer<typeof createTireStorageSchema>;
export type UpdateTireStorageInput = z.infer<typeof updateTireStorageSchema>;
export type ChangeTireStorageStatusInput = z.infer<typeof changeTireStorageStatusSchema>;
