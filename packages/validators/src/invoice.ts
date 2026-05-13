import { z } from 'zod';

export const generateInvoiceSchema = z.object({
  jobCardId: z.string().uuid(),
  customerPortion: z.coerce.number().min(0).optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  footer: z.string().max(2000).optional(),
});

export const recordInvoicePaymentSchema = z.object({
  amount: z.coerce.number().min(0.01),
  paymentMethod: z.string().transform((v) => v.toLowerCase()).pipe(z.enum(['cash', 'transfer', 'card', 'mpesa', 'pix', 'multicaixa', 'other'])),
  reference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  paymentDate: z.string().optional(),
});

export const createCreditNoteSchema = z.object({
  amount: z.coerce.number().min(0.01),
  reason: z.string().min(1).max(2000),
});

export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
export type RecordInvoicePaymentInput = z.infer<typeof recordInvoicePaymentSchema>;
export type CreateCreditNoteInput = z.infer<typeof createCreditNoteSchema>;

// ───────── Stand-alone parts sale (no job card) ─────────

// A single line item — used by both stand-alone invoices and
// proformas. Either partId (existing catalogue part) or just a
// description is required.
export const standaloneLineSchema = z
  .object({
    partId: z.string().uuid().optional(),
    description: z.string().min(1).max(500),
    quantity: z.coerce.number().positive(),
    unitCost: z.coerce.number().min(0).optional(),
    sellPrice: z.coerce.number().min(0),
    taxCodeId: z.string().uuid().optional(),
  });

export const createStandaloneInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  lines: z.array(standaloneLineSchema).min(1, 'At least one line is required'),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  footer: z.string().max(2000).optional(),
});

export const createProformaSchema = z.object({
  customerId: z.string().uuid(),
  lines: z.array(standaloneLineSchema).min(1, 'At least one line is required'),
  validUntil: z.string().optional(),
  notes: z.string().max(2000).optional(),
  footer: z.string().max(2000).optional(),
});

export const updateProformaSchema = z.object({
  customerId: z.string().uuid().optional(),
  lines: z.array(standaloneLineSchema).min(1).optional(),
  validUntil: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
  footer: z.string().max(2000).optional(),
});

export const cancelProformaSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type StandaloneLineInput = z.infer<typeof standaloneLineSchema>;
export type CreateStandaloneInvoiceInput = z.infer<typeof createStandaloneInvoiceSchema>;
export type CreateProformaInput = z.infer<typeof createProformaSchema>;
export type UpdateProformaInput = z.infer<typeof updateProformaSchema>;
export type CancelProformaInput = z.infer<typeof cancelProformaSchema>;
