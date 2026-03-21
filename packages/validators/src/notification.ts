import { z } from 'zod';

export const sendMessageSchema = z.object({
  phone: z.string().min(7).max(20),
  message: z.string().min(1).max(4096),
});

export const sendTestSchema = z.object({
  phone: z.string().min(7).max(20),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SendTestInput = z.infer<typeof sendTestSchema>;
