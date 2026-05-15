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

export const updateWorkshopUserSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  role: z.enum(['owner', 'manager', 'technician', 'receptionist']).optional(),
  /** UUID of a public.custom_roles row. null removes the override. */
  customRoleId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ── Custom roles ─────────────────────────────────────────────────

const capabilityKey = z.string().min(1).max(100).regex(/^[a-z0-9_.]+$/);

export const createCustomRoleSchema = z.object({
  key: capabilityKey,                              // e.g. 'workshop_admin'
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  capabilities: z.array(capabilityKey).default([]),
});

export const updateCustomRoleSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  capabilities: z.array(capabilityKey).optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  // tax_id used in snake_case to match the DB column and the
  // existing settings page payload. The earlier camelCase taxId
  // was being stripped silently by Zod.
  tax_id: z.string().max(50).nullable().optional(),
  taxId: z.string().max(50).optional(),
  logoUrl: z.string().optional(),
  // Bank details printed on invoices / receipts. Snake_case keys
  // because the settings page sends snake_case directly to match
  // DB column names — Zod's strip mode would otherwise discard
  // any camelCase aliases.
  bank_name: z.string().max(200).nullable().optional(),
  bank_account_number: z.string().max(60).nullable().optional(),
  bank_iban: z.string().max(40).nullable().optional(),
  bank_swift: z.string().max(20).nullable().optional(),
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

// Public: kick off a password reset by email. redirectTo points at the
// frontend page that will receive the Supabase access_token hash.
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
  redirectTo: z.string().url().optional(),
});

// Public-with-token: finalises the reset using the Supabase access_token
// that came back on the redirect. The token is validated server-side
// before the new password is set.
export const resetPasswordSchema = z.object({
  accessToken: z.string().min(20),
  password: z.string().min(8).max(72),
});

// Admin: set another user's password directly. Owner/manager only.
export const adminChangePasswordSchema = z.object({
  password: z.string().min(8).max(72),
});

// Self-service: change your own password while logged in. Requires
// the current password so a stolen session token alone can't lock
// the legitimate user out.
export const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(8).max(72),
  newPassword: z.string().min(8).max(72),
});

// Self-service: edit your own profile fields. Only the fields the
// user is allowed to change themselves — role and active state stay
// under owner/manager control. Locale is tenant-wide for now (no
// per-user locale column).
export const updateOwnProfileSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateWorkshopUserInput = z.infer<typeof updateWorkshopUserSchema>;
export type CreateCustomRoleInput = z.infer<typeof createCustomRoleSchema>;
export type UpdateCustomRoleInput = z.infer<typeof updateCustomRoleSchema>;
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;
export type CustomerSignUpInput = z.infer<typeof customerSignUpSchema>;
export type SetExchangeRateInput = z.infer<typeof setExchangeRateSchema>;
export type SetSecondaryCurrencyInput = z.infer<typeof setSecondaryCurrencySchema>;
export type SetTenantSettingInput = z.infer<typeof setTenantSettingSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AdminChangePasswordInput = z.infer<typeof adminChangePasswordSchema>;
export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
