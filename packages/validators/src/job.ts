import { z } from 'zod';

// ---------- Technicians ----------

export const createTechnicianSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().min(7).max(20).optional(),
  specializations: z.array(z.string()).default([]),
  hourlyRate: z.coerce.number().min(0).optional(),
  isActive: z.boolean().default(true),
});

export const updateTechnicianSchema = createTechnicianSchema.partial();

export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;
export type UpdateTechnicianInput = z.infer<typeof updateTechnicianSchema>;

// ---------- Job Cards ----------

export const jobTypeEnum = z.enum(['mechanical', 'body_repair']);

export const createJobCardSchema = z.object({
  vehicleId: z.string().uuid(),
  customerId: z.string().uuid(),
  jobType: jobTypeEnum.default('mechanical'),
  reportedProblem: z.string().max(5000).default(''),
  symptomCodes: z.array(z.string()).default([]),
  internalNotes: z.string().max(5000).optional(),
  primaryTechnicianId: z.string().uuid().optional(),
  isInsurance: z.boolean().default(false),
  isTaxable: z.boolean().default(true),
  requiresAuthorization: z.boolean().default(false),
  labels: z.array(z.string()).default([]),
  estimatedCompletion: z.string().optional(),
  partsIssuingMode: z.enum(['auto', 'manual']).default('auto'),
  insuranceCompany: z.string().max(200).optional(),
  policyNumber: z.string().max(100).optional(),
  claimReference: z.string().max(100).optional(),
  excessAmount: z.coerce.number().min(0).optional(),
  customerRemarks: z.string().max(5000).optional(),
  estimateFooter: z.string().max(2000).optional(),
  isComeback: z.boolean().default(false),
  comebackOriginalJobId: z.string().uuid().optional(),
  comebackReason: z.string().max(2000).optional(),
  parentJobId: z.string().uuid().optional(),
  subJobLabel: z.string().max(100).optional(),
  isWarranty: z.boolean().default(false),
  warrantyType: z.enum(['parts', 'labour', 'full', 'oem']).optional(),
  warrantyClaimRef: z.string().max(100).optional(),
  warrantySupplier: z.string().max(200).optional(),
  priorityLevel: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  branchId: z.string().uuid().optional(),
}).refine((data) => data.reportedProblem.trim().length > 0 || data.symptomCodes.length > 0, {
  message: 'Either a reported problem or at least one symptom must be provided',
  path: ['reportedProblem'],
});

export const updateJobCardSchema = z.object({
  reportedProblem: z.string().min(1).max(5000).optional(),
  internalNotes: z.string().max(5000).optional(),
  primaryTechnicianId: z.string().uuid().nullable().optional(),
  labels: z.array(z.string()).optional(),
  estimatedCompletion: z.string().nullable().optional(),
  isInsurance: z.boolean().optional(),
  isTaxable: z.boolean().optional(),
  requiresAuthorization: z.boolean().optional(),
  customerRemarks: z.string().max(5000).optional(),
  estimateFooter: z.string().max(2000).optional(),
  insuranceCompany: z.string().max(200).optional(),
  policyNumber: z.string().max(100).optional(),
  claimReference: z.string().max(100).optional(),
  excessAmount: z.coerce.number().min(0).optional(),
});

export const changeStatusSchema = z.object({
  status: z.string().min(1),
  notes: z.string().max(2000).optional(),
});

export const convertJobTypeSchema = z.object({
  jobType: jobTypeEnum,
});

export type CreateJobCardInput = z.infer<typeof createJobCardSchema>;
export type UpdateJobCardInput = z.infer<typeof updateJobCardSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type ConvertJobTypeInput = z.infer<typeof convertJobTypeSchema>;
export type JobType = z.infer<typeof jobTypeEnum>;

// ---------- Labour Lines ----------

export const createLabourLineSchema = z.object({
  description: z.string().min(1).max(500),
  hours: z.coerce.number().min(0),
  rate: z.coerce.number().min(0),
  technicianId: z.string().uuid().optional(),
  taxCodeId: z.string().uuid().optional(),
  warrantyMonths: z.coerce.number().int().min(0).max(240).optional(),
  warrantyKm: z.coerce.number().int().min(0).optional(),
});

export const updateLabourLineSchema = createLabourLineSchema.partial();

export type CreateLabourLineInput = z.infer<typeof createLabourLineSchema>;
export type UpdateLabourLineInput = z.infer<typeof updateLabourLineSchema>;

// ---------- Parts Lines ----------

export const createPartsLineSchema = z.object({
  partName: z.string().min(1).max(500),
  partNumber: z.string().max(100).optional(),
  quantity: z.coerce.number().min(0),
  unitCost: z.coerce.number().min(0),
  markupPct: z.coerce.number().min(0).default(0),
  taxCodeId: z.string().uuid().optional(),
  warrantyMonths: z.coerce.number().int().min(0).max(240).optional(),
  warrantyKm: z.coerce.number().int().min(0).optional(),
});

export const updatePartsLineSchema = createPartsLineSchema.partial();

export type CreatePartsLineInput = z.infer<typeof createPartsLineSchema>;
export type UpdatePartsLineInput = z.infer<typeof updatePartsLineSchema>;

// ---------- QC Checks ----------

export const upsertJobQcSchema = z.object({
  allWorkCompleted: z.boolean().optional(),
  testDriveDone: z.boolean().optional(),
  testDriveNotes: z.string().max(2000).optional(),
  washDone: z.boolean().optional(),
  fluidLevelsChecked: z.boolean().optional(),
  torqueRecheckDone: z.boolean().optional(),
  codesCleared: z.boolean().optional(),
  toolsRemoved: z.boolean().optional(),
  personalItemsVerified: z.boolean().optional(),
  mileageOut: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().max(5000).optional(),
  passed: z.boolean().optional(),
  signatureUrl: z.string().url().max(2000).optional(),
});

export type UpsertJobQcInput = z.infer<typeof upsertJobQcSchema>;

// ---------- Body-Repair Stages (job_type='body_repair' only) ----------

export const upsertJobBodyStagesSchema = z.object({
  disassemblyDone:   z.boolean().optional(),
  frameCheckDone:    z.boolean().optional(),
  bodyRepairDone:    z.boolean().optional(),
  paintPrepDone:     z.boolean().optional(),
  refinishDone:      z.boolean().optional(),
  bakeDone:          z.boolean().optional(),
  reassemblyDone:    z.boolean().optional(),
  polishDone:        z.boolean().optional(),
  disassemblyNotes:  z.string().max(2000).optional(),
  frameCheckNotes:   z.string().max(2000).optional(),
  bodyRepairNotes:   z.string().max(2000).optional(),
  paintPrepNotes:    z.string().max(2000).optional(),
  refinishNotes:     z.string().max(2000).optional(),
  bakeNotes:         z.string().max(2000).optional(),
  reassemblyNotes:   z.string().max(2000).optional(),
  polishNotes:       z.string().max(2000).optional(),
});

export type UpsertJobBodyStagesInput = z.infer<typeof upsertJobBodyStagesSchema>;

// ---------- Pickup Signature ----------

export const pickupSignatureSchema = z.object({
  signatureDataUrl: z
    .string()
    .min(20)
    .max(500_000)
    .refine((s) => s.startsWith('data:image/'), 'Must be a data URL image'),
  signedName: z.string().min(1).max(200),
  mileageOut: z.coerce.number().int().nonnegative().optional(),
});

export type PickupSignatureInput = z.infer<typeof pickupSignatureSchema>;

// ---------- Line Photos ----------

export const createLinePhotoSchema = z
  .object({
    lineKind: z.enum(['parts', 'labour']),
    partsLineId: z.string().uuid().optional(),
    labourLineId: z.string().uuid().optional(),
    snapshot: z.enum(['before', 'after']),
    base64Data: z
      .string()
      .min(20)
      .max(5_000_000)
      .refine((s) => s.startsWith('data:image/'), 'Must be a data URL image')
      .optional(),
    storageUrl: z.string().url().max(2000).optional(),
    caption: z.string().max(500).optional(),
  })
  .refine(
    (v) =>
      (v.lineKind === 'parts' && !!v.partsLineId && !v.labourLineId) ||
      (v.lineKind === 'labour' && !!v.labourLineId && !v.partsLineId),
    { message: 'Exactly one of partsLineId or labourLineId must match lineKind' },
  )
  .refine((v) => Boolean(v.base64Data || v.storageUrl), {
    message: 'Either base64Data or storageUrl is required',
  });

export type CreateLinePhotoInput = z.infer<typeof createLinePhotoSchema>;
