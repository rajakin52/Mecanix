import { z } from 'zod';

export const viewAngleEnum = z.enum([
  'front', 'front_left', 'front_right',
  'left', 'right',
  'rear', 'rear_left', 'rear_right',
  'roof', 'interior', 'detail', 'vin_plate', 'odometer', 'other',
]);

export const damageTypeEnum = z.enum([
  'dent', 'scratch', 'tear', 'crack', 'misalignment', 'paint_blemish', 'missing', 'other',
]);

export const operationEnum = z.enum(['replace', 'repair', 'paint', 'blend', 'r_and_i']);

export const sourceEnum = z.enum(['manual', 'model', 'reviewer_override']);

export const createAssessmentSchema = z.object({
  vehicleId: z.string().uuid(),
  jobCardId: z.string().uuid().optional(),
  claimId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});

export const updateAssessmentSchema = z.object({
  status: z.enum(['capturing', 'analysing', 'ready', 'approved', 'rejected', 'cancelled']).optional(),
  reviewNotes: z.string().max(4000).optional(),
});

export const uploadPhotoSchema = z.object({
  file: z.string().min(1, 'file (base64) is required'),
  filename: z.string().min(1).max(200),
  viewAngle: viewAngleEnum.optional(),
  panelHint: z.string().max(80).optional(),
  exifLat: z.number().optional(),
  exifLng: z.number().optional(),
  exifTakenAt: z.string().datetime().optional(),
});

export const createFindingSchema = z.object({
  panel: z.string().min(1).max(80),
  damageType: damageTypeEnum,
  severity: z.coerce.number().int().min(1).max(5),
  areaPct: z.coerce.number().min(0).max(100).optional(),
  confidence: z.coerce.number().min(0).max(1).optional(),
  source: sourceEnum.default('manual'),
  modelVersion: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
});

export const updateFindingSchema = createFindingSchema.partial();

export const createOperationSchema = z.object({
  findingId: z.string().uuid().optional(),
  panel: z.string().min(1).max(80),
  operation: operationEnum,
  labourHours: z.coerce.number().min(0).default(0),
  partsCost: z.coerce.number().min(0).default(0),
  paintCost: z.coerce.number().min(0).default(0),
  oemPartNumber: z.string().max(80).optional(),
  source: sourceEnum.default('manual'),
  notes: z.string().max(2000).optional(),
});

export const updateOperationSchema = createOperationSchema.partial();

export const finaliseAssessmentSchema = z.object({
  approve: z.boolean(),
  notes: z.string().max(4000).optional(),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;
export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;
export type UploadAssessmentPhotoInput = z.infer<typeof uploadPhotoSchema>;
export type CreateAssessmentFindingInput = z.infer<typeof createFindingSchema>;
export type UpdateAssessmentFindingInput = z.infer<typeof updateFindingSchema>;
export type CreateAssessmentOperationInput = z.infer<typeof createOperationSchema>;
export type UpdateAssessmentOperationInput = z.infer<typeof updateOperationSchema>;
export type FinaliseAssessmentInput = z.infer<typeof finaliseAssessmentSchema>;
