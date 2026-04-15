import { z } from 'zod';

export const createSymptomCodeSchema = z.object({
  code: z.string().min(1).max(50),
  labelEn: z.string().min(1).max(200),
  labelPt: z.string().min(1).max(200),
  family: z.enum(['quick_service', 'mechanic', 'body_paint']),
  category: z.string().min(1).max(50),
  icon: z.string().max(10).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export type CreateSymptomCodeInput = z.infer<typeof createSymptomCodeSchema>;
