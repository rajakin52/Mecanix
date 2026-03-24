import { z } from 'zod';

export const earnPointsSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().min(0),
});

export const redeemPointsSchema = z.object({
  points: z.coerce.number().int().min(1),
  description: z.string().min(1),
});

export type EarnPointsInput = z.infer<typeof earnPointsSchema>;
export type RedeemPointsInput = z.infer<typeof redeemPointsSchema>;
