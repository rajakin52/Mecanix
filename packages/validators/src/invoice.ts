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
  paymentMethod: z.enum(['cash', 'transfer', 'card', 'mpesa', 'pix', 'multicaixa', 'other']),
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
