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

export const createJobCardSchema = z.object({
  vehicleId: z.string().uuid(),
  customerId: z.string().uuid(),
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

export type CreateJobCardInput = z.infer<typeof createJobCardSchema>;
export type UpdateJobCardInput = z.infer<typeof updateJobCardSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

// ---------- Labour Lines ----------

export const createLabourLineSchema = z.object({
  description: z.string().min(1).max(500),
  hours: z.coerce.number().min(0),
  rate: z.coerce.number().min(0),
  technicianId: z.string().uuid().optional(),
  taxCodeId: z.string().uuid().optional(),
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
