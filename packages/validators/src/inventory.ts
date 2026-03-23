import { z } from 'zod';

// ---------- Parts ----------

export const createPartSchema = z.object({
  partNumber: z.string().max(100).optional(),
  description: z.string().min(1).max(500),
  unitCost: z.coerce.number().min(0),
  sellPrice: z.coerce.number().min(0),
  stockQty: z.coerce.number().int().min(0).default(0),
  reorderPoint: z.coerce.number().int().min(0).default(0),
  supplierId: z.string().uuid().optional(),
  category: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
});

export const updatePartSchema = createPartSchema.partial();

export type CreatePartInput = z.infer<typeof createPartSchema>;
export type UpdatePartInput = z.infer<typeof updatePartSchema>;

export const adjustStockSchema = z.object({
  quantityChange: z.coerce.number().int(),
  reason: z.string().min(1).max(500),
  reference: z.string().max(200).optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

// ---------- Service Groups ----------

export const createServiceGroupSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  labourItems: z.array(z.record(z.unknown())).default([]),
  partsItems: z.array(z.record(z.unknown())).default([]),
});

export const updateServiceGroupSchema = createServiceGroupSchema.partial();

export type CreateServiceGroupInput = z.infer<typeof createServiceGroupSchema>;
export type UpdateServiceGroupInput = z.infer<typeof updateServiceGroupSchema>;

// ---------- Vendors ----------

export const createVendorSchema = z.object({
  name: z.string().min(1).max(200),
  contactName: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  taxId: z.string().max(50).optional(),
  leadTimeDays: z.coerce.number().int().min(0).optional().or(z.literal('')),
  paymentTerms: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;

// ---------- Purchase Orders ----------

const poLineSchema = z.object({
  partId: z.string().uuid(),
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().int().min(1),
  unitCost: z.coerce.number().min(0),
});

export const createPurchaseOrderSchema = z.object({
  vendorId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
  expectedDate: z.string().optional(),
  lines: z.array(poLineSchema).min(1),
});

export const createPoLineSchema = poLineSchema;

export const receiveGoodsSchema = z.object({
  lineId: z.string().uuid(),
  receivedQty: z.coerce.number().int().min(1),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type CreatePoLineInput = z.infer<typeof createPoLineSchema>;
export type ReceiveGoodsInput = z.infer<typeof receiveGoodsSchema>;

// ---------- Bills ----------

export const createBillSchema = z.object({
  vendorId: z.string().uuid(),
  billNumber: z.string().min(1).max(100),
  amount: z.coerce.number().min(0),
  dueDate: z.string(),
  purchaseOrderId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().min(0.01),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

// ---------- Expenses ----------

export const createExpenseSchema = z.object({
  category: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  amount: z.coerce.number().min(0),
  expenseDate: z.string(),
  receiptUrl: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
