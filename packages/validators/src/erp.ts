import { z } from 'zod';

export const saveErpConfigSchema = z.object({
  provider: z.enum(['primavera_v10', 'saft_export']).optional(),
  isActive: z.boolean().optional(),
  baseUrl: z.string().max(500).optional().nullable(),
  companyCode: z.string().max(50).optional().nullable(),
  username: z.string().max(200).optional().nullable(),
  password: z.string().max(500).optional().nullable(),
  instanceName: z.string().max(100).optional(),
  invoiceSeries: z.string().max(50).optional(),
  creditNoteSeries: z.string().max(50).optional(),
  receiptSeries: z.string().max(50).optional(),
  taxMapping: z.record(z.string(), z.string()).optional(),
  baseCurrency: z.string().length(3).optional(),
  autoExportInvoices: z.boolean().optional(),
  autoExportPayments: z.boolean().optional(),
  defaultLabourArticle: z.string().max(50).optional(),
  defaultPartsArticle: z.string().max(50).optional(),
  captiveVatAccount: z.string().max(50).optional().nullable(),
  serviceRetentionAccount: z.string().max(50).optional().nullable(),
});

export type SaveErpConfigInput = z.infer<typeof saveErpConfigSchema>;
