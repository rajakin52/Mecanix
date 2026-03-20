import { z } from 'zod';

// ---------- Technicians ----------

export const createTechnicianSchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().min(7).max(20).optional(),
  specializations: z.array(z.string()).default([]),
  hourlyRate: z.number().min(0).optional(),
  isActive: z.boolean().default(true),
});

export const updateTechnicianSchema = createTechnicianSchema.partial();

export type CreateTechnicianInput = z.infer<typeof createTechnicianSchema>;
export type UpdateTechnicianInput = z.infer<typeof updateTechnicianSchema>;

// ---------- Job Cards ----------

export const createJobCardSchema = z.object({
  vehicleId: z.string().uuid(),
  customerId: z.string().uuid(),
  reportedProblem: z.string().min(1).max(5000),
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
  excessAmount: z.number().min(0).optional(),
  customerRemarks: z.string().max(5000).optional(),
  estimateFooter: z.string().max(2000).optional(),
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
  excessAmount: z.number().min(0).optional(),
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
  hours: z.number().min(0),
  rate: z.number().min(0),
  technicianId: z.string().uuid().optional(),
});

export const updateLabourLineSchema = createLabourLineSchema.partial();

export type CreateLabourLineInput = z.infer<typeof createLabourLineSchema>;
export type UpdateLabourLineInput = z.infer<typeof updateLabourLineSchema>;

// ---------- Parts Lines ----------

export const createPartsLineSchema = z.object({
  partName: z.string().min(1).max(500),
  partNumber: z.string().max(100).optional(),
  quantity: z.number().min(0),
  unitCost: z.number().min(0),
  markupPct: z.number().min(0).default(0),
});

export const updatePartsLineSchema = createPartsLineSchema.partial();

export type CreatePartsLineInput = z.infer<typeof createPartsLineSchema>;
export type UpdatePartsLineInput = z.infer<typeof updatePartsLineSchema>;
