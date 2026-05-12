import { z } from 'zod';
import { titleCase, sentenceCase } from './_case';

export const createCustomerSchema = z.object({
  fullName: z.string().min(2).max(200).transform(titleCase),
  phone: z.string().min(7).max(20),
  whatsappNumber: z.string().min(7).max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  taxId: z.string().optional(),
  address: z.string().max(500).optional(),
  addressStreet: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional().transform((v) => (v ? titleCase(v) : v)),
  addressState: z.string().max(100).optional().transform((v) => (v ? titleCase(v) : v)),
  addressPostal: z.string().max(20).optional(),
  addressCountry: z.string().max(100).optional().transform((v) => (v ? titleCase(v) : v)),
  paymentTerms: z.string().max(200).optional(),
  notes: z.string().max(2000).optional().transform((v) => (v ? sentenceCase(v) : v)),
  isCorporate: z.boolean().default(false),
  isAccountCustomer: z.boolean().default(false),
  creditTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  companyName: z.string().max(200).optional().transform((v) => (v ? titleCase(v) : v)),
  billingContact: z.string().max(200).optional().transform((v) => (v ? titleCase(v) : v)),
  creditLimit: z.coerce.number().min(0).optional(),
  priceGroupId: z.string().uuid().optional().or(z.literal('')),
  preferredChannel: z.enum(['whatsapp', 'email', 'app', 'sms']).optional(),
  // Angola tax treatment
  vatCaptivePct: z.union([z.literal(0), z.literal(50), z.literal(100)]).default(0),
  withholdsServiceRetention: z.boolean().default(false),
  // Materials-charge overrides (nullable — fall back to insurance/tenant)
  materialsRateRefinish: z.coerce.number().min(0).optional().nullable(),
  materialsRateBody: z.coerce.number().min(0).optional().nullable(),
  shopSuppliesPct: z.coerce.number().min(0).max(1).optional().nullable(),
  shopSuppliesCap: z.coerce.number().min(0).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
