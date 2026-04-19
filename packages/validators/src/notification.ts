import { z } from 'zod';

export const sendMessageSchema = z.object({
  phone: z.string().min(7).max(20),
  message: z.string().min(1).max(4096),
});

export const sendTestSchema = z.object({
  phone: z.string().min(7).max(20),
});

export const mpesaPaySchema = z.object({
  phoneNumber: z.string().min(9).max(15),
  amount: z.coerce.number().min(1),
  invoiceId: z.string().uuid(),
});

export const registerPushTokenSchema = z.object({
  pushToken: z.string().min(1).max(500),
  platform: z.enum(['ios', 'android', 'web']),
  appType: z.enum(['customer', 'workshop', 'technician']),
});

export const deactivatePushTokenSchema = z.object({
  pushToken: z.string().min(1).max(500),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SendTestInput = z.infer<typeof sendTestSchema>;
export type MpesaPayInput = z.infer<typeof mpesaPaySchema>;
export type RegisterPushTokenInput = z.infer<typeof registerPushTokenSchema>;
export type DeactivatePushTokenInput = z.infer<typeof deactivatePushTokenSchema>;
