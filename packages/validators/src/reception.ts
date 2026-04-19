import { z } from 'zod';

export const damagePointSchema = z.object({
  bodyZone: z.string().min(1).max(100),
  damageType: z.enum([
    'scratch', 'dent', 'crack', 'chip', 'broken', 'missing',
    'rust', 'paint_damage', 'glass_crack', 'torn',
  ]),
  severity: z.enum(['minor', 'moderate', 'severe']),
  diagramView: z.enum(['top', 'left', 'right', 'front_rear']).optional(),
  coordinateX: z.coerce.number().optional(),
  coordinateY: z.coerce.number().optional(),
  note: z.string().max(1000).optional(),
});

export const checklistItemSchema = z.object({
  category: z.enum(['safety', 'accessory', 'belonging']),
  itemCode: z.string().max(100).optional(),
  itemLabel: z.string().min(1).max(200),
  status: z.enum(['present', 'absent', 'damaged', 'expired', 'na']),
  detail: z.string().max(500).optional(),
});

export const createReceptionSchema = z.object({
  jobCardId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  odometerKm: z.coerce.number().int().min(0),
  fuelLevel: z.enum(['empty', 'quarter', 'half', 'three_quarter', 'full']),
  keyType: z.enum(['standard', 'remote', 'keyless', 'valet']).optional(),
  keysReceived: z.coerce.number().int().min(0).max(10).optional(),
  reportedIssues: z.string().max(4000).optional(),
  symptomCodes: z.array(z.string().max(100)).optional(),
  damagePoints: z.array(damagePointSchema).optional(),
  checklistItems: z.array(checklistItemSchema).optional(),
  signatureData: z.string().max(2_000_000).optional(),
  signatureMethod: z.string().max(50).optional(),
  signedByName: z.string().max(200).optional(),
  contactPhone: z.string().max(40).optional(),
});

export const updateReceptionSchema = createReceptionSchema
  .partial()
  .omit({ jobCardId: true, vehicleId: true });

export const saveChecklistSchema = z.object({
  items: z.array(checklistItemSchema),
});

export const signReceptionSchema = z.object({
  signatureData: z.string().min(1).max(2_000_000),
  signatureMethod: z.string().max(50).optional(),
  signedByName: z.string().max(200).optional(),
});

export type DamagePointInput = z.infer<typeof damagePointSchema>;
export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;
export type CreateReceptionInput = z.infer<typeof createReceptionSchema>;
export type UpdateReceptionInput = z.infer<typeof updateReceptionSchema>;
export type SaveChecklistInput = z.infer<typeof saveChecklistSchema>;
export type SignReceptionInput = z.infer<typeof signReceptionSchema>;
