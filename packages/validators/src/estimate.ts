import { z } from 'zod';

// A single line item on a standalone estimate (labour or part).
export const estimateLineSchema = z.object({
  type: z.enum(['labour', 'parts']),
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  hours: z.coerce.number().min(0).optional(),
  rate: z.coerce.number().min(0).optional(),
  partNumber: z.string().max(100).optional(),
  markupPct: z.coerce.number().min(0).max(500).optional(),
});

export const createStandaloneEstimateSchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  reportedProblem: z.string().max(4000).optional(),
  lines: z.array(estimateLineSchema).min(1),
  terms: z.string().max(4000).optional(),
  validUntil: z.string().optional(),
  notes: z.string().max(4000).optional(),
});

export const updateStandaloneEstimateSchema = createStandaloneEstimateSchema.partial();

export const convertEstimateSchema = z.object({
  notes: z.string().max(4000).optional(),
}).partial();

export const approveStandaloneEstimateSchema = z.object({
  notes: z.string().max(4000).optional(),
  signatureUrl: z.string().max(2_000_000).optional(),
  method: z.string().max(50).optional(),
});

export const rejectStandaloneEstimateSchema = z.object({
  notes: z.string().max(4000).optional(),
});

export const publicEstimateActionSchema = z.object({
  notes: z.string().max(4000).optional(),
});

export type EstimateLineInput = z.infer<typeof estimateLineSchema>;
export type CreateStandaloneEstimateInput = z.infer<typeof createStandaloneEstimateSchema>;
export type UpdateStandaloneEstimateInput = z.infer<typeof updateStandaloneEstimateSchema>;
export type ConvertEstimateInput = z.infer<typeof convertEstimateSchema>;
export type ApproveStandaloneEstimateInput = z.infer<typeof approveStandaloneEstimateSchema>;
export type RejectStandaloneEstimateInput = z.infer<typeof rejectStandaloneEstimateSchema>;
export type PublicEstimateActionInput = z.infer<typeof publicEstimateActionSchema>;
