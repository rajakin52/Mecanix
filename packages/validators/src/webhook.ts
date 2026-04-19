import { z } from 'zod';

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(200),
  url: z.string().url().max(2000),
  secret: z.string().max(500).optional(),
  events: z.array(z.string().max(100)).min(1).max(50),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  url: z.string().url().max(2000).optional(),
  secret: z.string().max(500).optional(),
  events: z.array(z.string().max(100)).min(1).max(50).optional(),
  is_active: z.boolean().optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
