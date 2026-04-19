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

export const inviteUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2).max(100),
  role: z.enum(['manager', 'technician', 'receptionist']),  // NOT owner — can't invite owners
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  taxId: z.string().max(50).optional(),
  logoUrl: z.string().optional(),
});

export const setExchangeRateSchema = z.object({
  rate: z.coerce.number().positive().max(1_000_000),
});

export const setSecondaryCurrencySchema = z.object({
  currency: z.string().length(3).nullable(),
});

export const setTenantSettingSchema = z.object({
  value: z.string().max(10_000),
});

export const customerSignUpSchema = z.object({
  fullName: z.string().min(2).max(200),
  email: z.string().email(),
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(72),
  workshopCode: z.string().optional(), // Tenant slug — links to workshop
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CustomerSignUpInput = z.infer<typeof customerSignUpSchema>;
export type SetExchangeRateInput = z.infer<typeof setExchangeRateSchema>;
export type SetSecondaryCurrencyInput = z.infer<typeof setSecondaryCurrencySchema>;
export type SetTenantSettingInput = z.infer<typeof setTenantSettingSchema>;
