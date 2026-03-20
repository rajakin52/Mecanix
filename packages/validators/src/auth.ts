import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signUpSchema = z.object({
  workshopName: z.string().min(2).max(100),
  country: z.enum(['AO', 'MZ', 'BR', 'PT']),
  currency: z.enum(['AOA', 'MZN', 'BRL', 'EUR']),
  ownerName: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  phone: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
