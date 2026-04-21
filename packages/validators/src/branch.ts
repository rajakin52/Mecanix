import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  address: z.string().max(500).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateBranchSchema = createBranchSchema.partial();

export const branchTransferSchema = z.object({
  partId: z.string().uuid(),
  fromWarehouseId: z.string().uuid(),
  toWarehouseId: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  notes: z.string().max(1000).optional(),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;
export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;
export type BranchTransferInput = z.infer<typeof branchTransferSchema>;
