import { z } from 'zod';

// --- Price Groups ---

export const createPriceGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  defaultMarkupPct: z.coerce.number().min(0).max(999),
});

export const updatePriceGroupSchema = createPriceGroupSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreatePriceGroupInput = z.infer<typeof createPriceGroupSchema>;
export type UpdatePriceGroupInput = z.infer<typeof updatePriceGroupSchema>;

// --- Price Group Rules (per-category overrides) ---

export const createPriceGroupRuleSchema = z.object({
  partCategory: z.string().min(1).max(100),
  markupPct: z.coerce.number().min(0).max(999),
});

export type CreatePriceGroupRuleInput = z.infer<typeof createPriceGroupRuleSchema>;

// --- Tenant Pricing Settings ---

export const updatePricingSettingsSchema = z.object({
  pricingMode: z.enum(['automatic', 'manual']).optional(),
  defaultMarkupPct: z.coerce.number().min(0).max(999).optional(),
  allowManualOverride: z.boolean().optional(),
});

export type UpdatePricingSettingsInput = z.infer<typeof updatePricingSettingsSchema>;
