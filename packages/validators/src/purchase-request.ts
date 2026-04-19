import { z } from 'zod';

export const purchaseRequestItemSchema = z.object({
  partId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  estimatedUnitCost: z.coerce.number().min(0).optional(),
});

export const createPurchaseRequestSchema = z.object({
  jobCardId: z.string().uuid(),
  partsRequestId: z.string().uuid().optional(),
  items: z.array(purchaseRequestItemSchema).min(1).max(200),
  notes: z.string().max(4000).optional(),
});

export const approvePurchaseRequestSchema = z.object({
  via: z.string().max(50).optional(),
});

export const rejectPurchaseRequestSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const linkPurchaseOrderSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  vendorId: z.string().uuid(),
});

export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type ApprovePurchaseRequestInput = z.infer<typeof approvePurchaseRequestSchema>;
export type RejectPurchaseRequestInput = z.infer<typeof rejectPurchaseRequestSchema>;
export type LinkPurchaseOrderInput = z.infer<typeof linkPurchaseOrderSchema>;
