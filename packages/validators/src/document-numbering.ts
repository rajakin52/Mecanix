import { z } from 'zod';

export const DOCUMENT_NUMBERING_TYPES = [
  'job_card',
  'estimate',
  'claim',
  'purchase_order',
  'purchase_request',
  'parts_request',
  'putaway_task',
  'receipt',
  'credit_note',
  'stock_count',
  'stock_transfer',
  'gate_pass',
] as const;

export type DocumentNumberingType = (typeof DOCUMENT_NUMBERING_TYPES)[number];

export const RESET_POLICIES = ['never', 'yearly', 'monthly'] as const;
export const YEAR_FORMATS = ['none', 'prefix', 'embedded'] as const;

export const updateDocumentNumberingSchema = z.object({
  prefix: z.string().max(16).optional(),
  padding: z.number().int().min(1).max(10).optional(),
  resetPolicy: z.enum(RESET_POLICIES).optional(),
  yearFormat: z.enum(YEAR_FORMATS).optional(),
  separator: z.string().max(4).optional(),
});

export type UpdateDocumentNumberingInput = z.infer<typeof updateDocumentNumberingSchema>;
