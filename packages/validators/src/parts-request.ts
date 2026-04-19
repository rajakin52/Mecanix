import { z } from 'zod';

export const partsRequestItemSchema = z.object({
  partId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
});

export const createPartsRequestSchema = z.object({
  jobCardId: z.string().uuid(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  oldPartPhoto: z.string().max(20_000_000).optional(),
  oldPartNote: z.string().max(2000).optional(),
  warehouseId: z.string().uuid().optional(),
  items: z.array(partsRequestItemSchema).min(1).max(200),
});

export const cancelPartsRequestSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export type CreatePartsRequestInput = z.infer<typeof createPartsRequestSchema>;
export type CancelPartsRequestInput = z.infer<typeof cancelPartsRequestSchema>;
