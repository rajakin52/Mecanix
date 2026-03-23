import { z } from 'zod';

// ---------- Insurance Companies ----------

export const createInsuranceCompanySchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
  contactName: z.string().max(200).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().max(200).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  slaHours: z.coerce.number().int().min(0).optional(),
});

export const updateInsuranceCompanySchema = createInsuranceCompanySchema.partial();

export type CreateInsuranceCompanyInput = z.infer<typeof createInsuranceCompanySchema>;
export type UpdateInsuranceCompanyInput = z.infer<typeof updateInsuranceCompanySchema>;

// ---------- Claims ----------

export const initiateClaimSchema = z.object({
  jobCardId: z.string().uuid(),
  insuranceCompanyId: z.string().uuid(),
  policyNumber: z.string().max(100).optional(),
  excessAmount: z.coerce.number().min(0).optional(),
});

export const changeClaimStatusSchema = z.object({
  status: z.string().min(1),
  notes: z.string().max(2000).optional(),
  assessorName: z.string().max(200).optional(),
});

export const addClaimPhotoSchema = z.object({
  photoUrl: z.string().min(1).max(2000),
  stage: z.enum(['damage', 'repair', 'completion']),
  caption: z.string().max(500).optional(),
  gpsLat: z.coerce.number().optional(),
  gpsLng: z.coerce.number().optional(),
});

export type InitiateClaimInput = z.infer<typeof initiateClaimSchema>;
export type ChangeClaimStatusInput = z.infer<typeof changeClaimStatusSchema>;
export type AddClaimPhotoInput = z.infer<typeof addClaimPhotoSchema>;

// ---------- Estimates ----------

export const reviewEstimateLineSchema = z.object({
  assessorStatus: z.enum(['pending', 'approved', 'adjusted', 'rejected']),
  assessorPrice: z.coerce.number().min(0).optional(),
  assessorComment: z.string().max(2000).optional(),
});

export const approveEstimateSchema = z.object({
  assessorName: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
});

export type ReviewEstimateLineInput = z.infer<typeof reviewEstimateLineSchema>;
export type ApproveEstimateInput = z.infer<typeof approveEstimateSchema>;
