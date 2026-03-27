import { z } from 'zod';

// --- Catalog Item ---

export const catalogLabourItemSchema = z.object({
  description: z.string().min(1).max(500),
  hours: z.coerce.number().min(0),
  rate: z.coerce.number().min(0),
});

export const catalogPartsItemSchema = z.object({
  partId: z.string().uuid().optional().or(z.literal('')),
  partName: z.string().min(1).max(500),
  partNumber: z.string().max(100).optional(),
  quantity: z.coerce.number().min(0),
  unitCost: z.coerce.number().min(0),
  markupPct: z.coerce.number().min(0).default(0),
});

export const createCatalogItemSchema = z.object({
  type: z.enum(['maintenance_package', 'standard_repair']),
  code: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(100).optional(),
  vehicleTypes: z.array(z.string()).optional(),
  mileageInterval: z.coerce.number().min(0).optional(),
  estimatedHours: z.coerce.number().min(0).optional(),
  fixedPrice: z.coerce.number().min(0).optional(),
  quickAccess: z.boolean().default(false),
  labourItems: z.array(catalogLabourItemSchema).optional(),
  partsItems: z.array(catalogPartsItemSchema).optional(),
});

export const updateCatalogItemSchema = createCatalogItemSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const applyCatalogToJobSchema = z.object({
  catalogItemId: z.string().uuid(),
});

export type CreateCatalogItemInput = z.infer<typeof createCatalogItemSchema>;
export type UpdateCatalogItemInput = z.infer<typeof updateCatalogItemSchema>;
export type ApplyCatalogToJobInput = z.infer<typeof applyCatalogToJobSchema>;
export type CatalogLabourItem = z.infer<typeof catalogLabourItemSchema>;
export type CatalogPartsItem = z.infer<typeof catalogPartsItemSchema>;
