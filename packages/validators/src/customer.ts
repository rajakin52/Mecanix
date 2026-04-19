import { z } from 'zod';

export const createCustomerSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().min(7).max(20),
  whatsappNumber: z.string().min(7).max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  taxId: z.string().optional(),
  address: z.string().max(500).optional(),
  addressStreet: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressState: z.string().max(100).optional(),
  addressPostal: z.string().max(20).optional(),
  addressCountry: z.string().max(100).optional(),
  paymentTerms: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  isCorporate: z.boolean().default(false),
  isAccountCustomer: z.boolean().default(false),
  creditTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  companyName: z.string().max(200).optional(),
  billingContact: z.string().max(200).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  priceGroupId: z.string().uuid().optional().or(z.literal('')),
  preferredChannel: z.enum(['whatsapp', 'email', 'app', 'sms']).optional(),
  // Angola tax treatment
  vatCaptivePct: z.union([z.literal(0), z.literal(50), z.literal(100)]).default(0),
  withholdsServiceRetention: z.boolean().default(false),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
