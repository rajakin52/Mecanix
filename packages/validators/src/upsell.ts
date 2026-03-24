import { z } from 'zod';

export const createUpsellItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.coerce.number().min(0),
  category: z.enum(['service', 'product', 'package']).default('service'),
  icon: z.string().max(10).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  applicableTo: z.enum(['appointment', 'job_card', 'both']).default('both'),
});

export const updateUpsellItemSchema = createUpsellItemSchema.partial();

export type CreateUpsellItemInput = z.infer<typeof createUpsellItemSchema>;
export type UpdateUpsellItemInput = z.infer<typeof updateUpsellItemSchema>;
