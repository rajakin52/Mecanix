import { z } from 'zod';

export const createCustomerSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional().or(z.literal('')),
  taxId: z.string().optional(),
  address: z.string().max(500).optional(),
  paymentTerms: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  isCorporate: z.boolean().default(false),
  companyName: z.string().max(200).optional(),
  billingContact: z.string().max(200).optional(),
  creditLimit: z.coerce.number().min(0).optional(),
  priceGroupId: z.string().uuid().optional().or(z.literal('')),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
