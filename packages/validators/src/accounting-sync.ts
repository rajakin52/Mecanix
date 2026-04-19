import { z } from 'zod';

export const createAccountingConnectionSchema = z.object({
  provider: z.enum(['odoo', 'quickbooks', 'zoho', 'xero', 'sage']),
  baseUrl: z.string().max(500).optional(),
  databaseName: z.string().max(200).optional(),
  apiKey: z.string().max(500).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const updateAccountingConnectionSchema = z.object({
  provider: z.enum(['odoo', 'quickbooks', 'zoho', 'xero', 'sage']).optional(),
  baseUrl: z.string().max(500).optional(),
  databaseName: z.string().max(200).optional(),
  apiKey: z.string().max(500).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

export type CreateAccountingConnectionInput = z.infer<typeof createAccountingConnectionSchema>;
export type UpdateAccountingConnectionInput = z.infer<typeof updateAccountingConnectionSchema>;
