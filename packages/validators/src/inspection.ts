import { z } from 'zod';

export const createInspectionSchema = z.object({
  jobCardId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  mileageIn: z.coerce.number().int().min(0, 'Mileage is required'),
  fuelLevel: z.enum(['empty', 'quarter', 'half', 'three_quarter', 'full'], { required_error: 'Fuel level is required' }),
  exteriorDamage: z.array(z.object({
    location: z.string(),
    type: z.string(),
    description: z.string().optional(),
  })).default([]),
  hasSpareTire: z.boolean().default(false),
  hasJack: z.boolean().default(false),
  hasTools: z.boolean().default(false),
  hasRadio: z.boolean().default(false),
  hasMats: z.boolean().default(false),
  hasHubcaps: z.boolean().default(false),
  hasAntenna: z.boolean().default(false),
  hasDocuments: z.boolean().default(false),
  personalItems: z.string().max(2000).optional(),
  notes: z.string().max(2000).optional(),
  customerSignature: z.string().optional(),
  dviItems: z.array(z.object({
    name: z.string(),
    category: z.string(),
    status: z.enum(['green', 'yellow', 'red', 'not_inspected']).default('not_inspected'),
    notes: z.string().optional(),
    recommendation: z.string().optional(),
    photos: z.array(z.string()).optional(),
  })).optional(),
});

export const updateInspectionSchema = createInspectionSchema.partial();

export const createInspectionTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(['multi_point', 'pre_delivery', 'diagnostic', 'safety']).default('multi_point'),
  items: z.array(z.record(z.unknown())).default([]),
  isDefault: z.boolean().optional(),
});

export const updateDviItemSchema = z.object({
  status: z.enum(['green', 'yellow', 'red', 'not_inspected']).optional(),
  notes: z.string().max(2000).optional(),
  recommendation: z.string().max(2000).optional(),
  photos: z.array(z.string().max(2000)).max(20).optional(),
});

export const markItemsEstimatedSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1).max(200),
});

export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
export type UpdateInspectionInput = z.infer<typeof updateInspectionSchema>;
export type CreateInspectionTemplateInput = z.infer<typeof createInspectionTemplateSchema>;
export type UpdateDviItemInput = z.infer<typeof updateDviItemSchema>;
export type MarkItemsEstimatedInput = z.infer<typeof markItemsEstimatedSchema>;
