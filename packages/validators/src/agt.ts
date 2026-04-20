import { z } from 'zod';

export const updateAgtConfigSchema = z.object({
  environment: z.enum(['test', 'production']).optional(),
  softwareCertNumber: z.string().max(100).optional(),
  taxpayerNif: z.string().max(40).optional(),
  companyName: z.string().max(200).optional(),
  certificatePublicKey: z.string().max(20000).optional(),
  certificatePrivateKey: z.string().max(20000).optional(),
  autoSubmit: z.boolean().optional(),
  defaultSeriesCode: z.string().max(50).optional(),
});

export const createAgtSeriesSchema = z.object({
  documentType: z.enum(['FT', 'FR', 'FS', 'NC', 'ND', 'RE', 'GT', 'GR', 'GA', 'GC', 'GD']),
  seriesCode: z.string().min(1).max(20),
  fiscalYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const updateAgtSeriesSchema = z.object({
  isActive: z.boolean().optional(),
});

export const initializeAgtSeriesSchema = z.object({
  seriesCode: z.string().max(20).optional(),
});

export type UpdateAgtConfigInput = z.infer<typeof updateAgtConfigSchema>;
export type CreateAgtSeriesInput = z.infer<typeof createAgtSeriesSchema>;
export type UpdateAgtSeriesInput = z.infer<typeof updateAgtSeriesSchema>;
export type InitializeAgtSeriesInput = z.infer<typeof initializeAgtSeriesSchema>;

export const saftMonthlyExportSchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export type SaftMonthlyExportInput = z.infer<typeof saftMonthlyExportSchema>;
