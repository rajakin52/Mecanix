import { z } from 'zod';

export const createWarehouseSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  type: z.string().max(50).optional(),
  branchId: z.string().uuid().optional(),
  address: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateWarehouseSchema = createWarehouseSchema.partial();

export const moveStockSchema = z.object({
  partId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  reason: z.string().max(1000).optional(),
});

export const createStockCountSchema = z.object({
  warehouseId: z.string().uuid(),
  categoryFilter: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateStockCountLineSchema = z.object({
  countedQty: z.coerce.number().min(0),
  notes: z.string().max(1000).optional(),
});

export const stockTransferLineSchema = z.object({
  partId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
});

export const createStockTransferSchema = z.object({
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
  lines: z.array(stockTransferLineSchema).min(1).max(500),
});

export const landedCostAllocationEnum = z.enum(['by_value', 'by_quantity']);
export type LandedCostAllocation = z.infer<typeof landedCostAllocationEnum>;

export const landedCostSchema = z.object({
  type: z.string().min(1).max(100),
  amount: z.coerce.number().min(0),
  allocation_method: landedCostAllocationEnum.default('by_value'),
});

export const applyLandedCostsSchema = z.object({
  additionalCosts: z.array(landedCostSchema).min(1).max(50),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type UpdateWarehouseInput = z.infer<typeof updateWarehouseSchema>;
export type MoveStockInput = z.infer<typeof moveStockSchema>;
export type CreateStockCountInput = z.infer<typeof createStockCountSchema>;
export type UpdateStockCountLineInput = z.infer<typeof updateStockCountLineSchema>;
export type CreateStockTransferInput = z.infer<typeof createStockTransferSchema>;
export type ApplyLandedCostsInput = z.infer<typeof applyLandedCostsSchema>;
