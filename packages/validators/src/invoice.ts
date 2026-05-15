import { z } from 'zod';

export const generateInvoiceSchema = z.object({
  jobCardId: z.string().uuid(),
  customerPortion: z.coerce.number().min(0).optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  footer: z.string().max(2000).optional(),
  // When true (default), the job card transitions to 'invoiced' and
  // becomes read-only until reopened. When false, the invoice is
  // created but the job card stays open — used for partial invoicing
  // (parts backorder, progress billing).
  closeJobCard: z.coerce.boolean().optional().default(true),
  // Invoice-global discount. Applied to the lines total before VAT.
  // pct and amount are additive; the math engine clamps to lines_total.
  discountPct: z.coerce.number().min(0).max(100).optional().default(0),
  discountAmount: z.coerce.number().min(0).optional().default(0),
});

export const reopenJobCardSchema = z.object({
  reason: z.string().min(1).max(500),
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
export type ReopenJobCardInput = z.infer<typeof reopenJobCardSchema>;
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
    // Line-level discount. pct and amount are additive.
    discountPct: z.coerce.number().min(0).max(100).optional().default(0),
    discountAmount: z.coerce.number().min(0).optional().default(0),
  });

export const createStandaloneInvoiceSchema = z.object({
  customerId: z.string().uuid(),
  lines: z.array(standaloneLineSchema).min(1, 'At least one line is required'),
  dueDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  footer: z.string().max(2000).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional().default(0),
  discountAmount: z.coerce.number().min(0).optional().default(0),
  // Warehouse the stock leaves from. Optional — defaults to the tenant's
  // is_default warehouse. Required to disambiguate when a tenant runs
  // more than one warehouse.
  warehouseId: z.string().uuid().optional(),
});

export const createProformaSchema = z.object({
  customerId: z.string().uuid(),
  lines: z.array(standaloneLineSchema).min(1, 'At least one line is required'),
  validUntil: z.string().optional(),
  notes: z.string().max(2000).optional(),
  footer: z.string().max(2000).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional().default(0),
  discountAmount: z.coerce.number().min(0).optional().default(0),
});

export const updateProformaSchema = z.object({
  customerId: z.string().uuid().optional(),
  lines: z.array(standaloneLineSchema).min(1).optional(),
  validUntil: z.string().optional().nullable(),
  notes: z.string().max(2000).optional(),
  footer: z.string().max(2000).optional(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
  discountAmount: z.coerce.number().min(0).optional(),
});

export const cancelProformaSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type StandaloneLineInput = z.infer<typeof standaloneLineSchema>;
export type CreateStandaloneInvoiceInput = z.infer<typeof createStandaloneInvoiceSchema>;
export type CreateProformaInput = z.infer<typeof createProformaSchema>;
export type UpdateProformaInput = z.infer<typeof updateProformaSchema>;
export type CancelProformaInput = z.infer<typeof cancelProformaSchema>;
