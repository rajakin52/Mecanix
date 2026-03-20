import { z } from 'zod';

export const createCustomerSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional().or(z.literal('')),
  taxId: z.string().optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
