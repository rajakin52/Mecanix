import { z } from 'zod';

// ---------- Parts ----------

export const partCompatibilityRowSchema = z
  .object({
    make: z.string().min(1).max(100),
    model: z.string().max(100).optional().nullable(),
    yearFrom: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
    yearTo: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  })
  .refine(
    (r) => r.yearFrom == null || r.yearTo == null || r.yearFrom <= r.yearTo,
    { message: 'yearFrom must be ≤ yearTo', path: ['yearFrom'] },
  );

export const createPartSchema = z
  .object({
    partNumber: z.string().max(100).optional(),
    description: z.string().min(1).max(500),
    unitCost: z.coerce.number().min(0),
    sellPrice: z.coerce.number().min(0),
    stockQty: z.coerce.number().int().min(0).default(0),
    reorderPoint: z.coerce.number().int().min(0).default(0),
    supplierId: z.string().uuid().optional(),
    category: z.string().max(100).optional(),
    location: z.string().max(200).optional(),
    taxCodeId: z.string().uuid().optional(),
    defaultWarrantyMonths: z.coerce.number().int().min(0).max(240).optional(),
    defaultWarrantyKm: z.coerce.number().int().min(0).optional(),
    isUniversal: z.boolean().default(false),
    compatibility: z.array(partCompatibilityRowSchema).default([]),
  })
  .refine(
    (p) => p.isUniversal || (p.compatibility && p.compatibility.length > 0),
    {
      message:
        'A part must either be marked "Fits all vehicles" or have at least one compatibility row.',
      path: ['compatibility'],
    },
  );

export const updatePartSchema = z
  .object({
    partNumber: z.string().max(100).optional(),
    description: z.string().min(1).max(500).optional(),
    unitCost: z.coerce.number().min(0).optional(),
    sellPrice: z.coerce.number().min(0).optional(),
    stockQty: z.coerce.number().int().min(0).optional(),
    reorderPoint: z.coerce.number().int().min(0).optional(),
    supplierId: z.string().uuid().optional(),
    category: z.string().max(100).optional(),
    location: z.string().max(200).optional(),
    taxCodeId: z.string().uuid().optional(),
    defaultWarrantyMonths: z.coerce.number().int().min(0).max(240).optional(),
    defaultWarrantyKm: z.coerce.number().int().min(0).optional(),
    isUniversal: z.boolean().optional(),
    compatibility: z.array(partCompatibilityRowSchema).optional(),
  })
  .refine(
    (p) =>
      p.isUniversal === undefined && p.compatibility === undefined
        ? true
        : p.isUniversal === true || (p.compatibility && p.compatibility.length > 0),
    {
      message:
        'A part must either be marked "Fits all vehicles" or have at least one compatibility row.',
      path: ['compatibility'],
    },
  );

export type PartCompatibilityRow = z.infer<typeof partCompatibilityRowSchema>;
export type CreatePartInput = z.infer<typeof createPartSchema>;
export type UpdatePartInput = z.infer<typeof updatePartSchema>;

// Query string for the parts list when scoping to a specific vehicle.
// Used by the PO create form to narrow the picker.
export const partsVehicleFilterSchema = z.object({
  make: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
});

export type PartsVehicleFilter = z.infer<typeof partsVehicleFilterSchema>;

export const adjustStockSchema = z.object({
  quantityChange: z.coerce.number().int().negative('Only negative adjustments (stock corrections) are allowed. Stock increases must come from supplier invoices.'),
  reason: z.string().min(1).max(500),
  reference: z.string().max(200).optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

// Standalone stock-adjustment transaction. Unlike adjustStockSchema
// (which is the parts-detail decreases-only path), this one is the
// dedicated "Stock Adjustments" screen — gated to owner/manager and
// allows both directions, with a reason explaining the change.
export const createInventoryAdjustmentSchema = z.object({
  partId: z.string().uuid(),
  warehouseId: z.string().uuid().optional(),
  quantityChange: z.coerce.number().int().refine((n) => n !== 0, 'Quantity change cannot be zero'),
  reason: z.string().min(1, 'Reason is required').max(500),
  reference: z.string().max(200).optional(),
});

export type CreateInventoryAdjustmentInput = z.infer<typeof createInventoryAdjustmentSchema>;

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

export const updateVendorSchema = createVendorSchema.partial().extend({
  isActive: z.boolean().optional(),
});

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

export const billLineSchema = z.object({
  partId: z.string().uuid().optional(),
  partName: z.string().min(1).max(500),
  partNumber: z.string().max(100).optional(),
  quantity: z.coerce.number().int().min(1),
  unitCost: z.coerce.number().min(0),
});

export const createBillSchema = z.object({
  vendorId: z.string().uuid(),
  billNumber: z.string().min(1).max(100),
  dueDate: z.string(),
  purchaseOrderId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  lines: z.array(billLineSchema).min(1, 'At least one line item is required'),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().min(0.01),
  paymentMethod: z.string().optional(),
  reference: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export type BillLineInput = z.infer<typeof billLineSchema>;
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

export const ocrReceiptSchema = z.object({
  base64Data: z
    .string()
    .min(20)
    .max(10_000_000)
    .refine((s) => s.startsWith('data:image/'), 'Must be a data URL image'),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type OcrReceiptInput = z.infer<typeof ocrReceiptSchema>;
