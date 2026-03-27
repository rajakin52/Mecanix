import { z } from 'zod';

export const createInspectionSchema = z.object({
  jobCardId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  mileageIn: z.coerce.number().int().min(0).optional(),
  fuelLevel: z.enum(['empty', 'quarter', 'half', 'three_quarter', 'full']).optional(),
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

export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
export type UpdateInspectionInput = z.infer<typeof updateInspectionSchema>;
