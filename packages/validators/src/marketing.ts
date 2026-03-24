import { z } from 'zod';

export const createCampaignSchema = z.object({
  name: z.string().min(1),
  message: z.string().min(1),
  targetType: z.enum(['all_customers', 'inactive_customers', 'corporate', 'by_vehicle_make', 'custom']),
  targetFilter: z.record(z.unknown()).optional(),
  scheduledAt: z.string().optional(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
