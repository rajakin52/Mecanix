import { z } from 'zod';

export const aiRespondSchema = z.object({
  customerPhone: z.string().min(1),
  message: z.string().min(1),
});

export const aiDiagnoseSchema = z.object({
  reportedProblem: z.string().min(1),
  vehicleMake: z.string().min(1),
  vehicleModel: z.string().min(1),
  vehicleYear: z.coerce.number().int().optional(),
});

export const aiRewriteSchema = z.object({
  text: z.string().min(1).max(8000),
  locale: z.string().max(10).optional(),
});

export const aiGenerateEstimateSchema = z.object({
  reportedProblem: z.string().min(1).max(4000),
  symptomCodes: z.array(z.string().max(100)).max(50),
  vehicleMake: z.string().min(1).max(100),
  vehicleModel: z.string().min(1).max(100),
  vehicleYear: z.coerce.number().int().min(1900).max(2100).optional(),
});

export type AiRespondInput = z.infer<typeof aiRespondSchema>;
export type AiDiagnoseInput = z.infer<typeof aiDiagnoseSchema>;
export type AiRewriteInput = z.infer<typeof aiRewriteSchema>;
export type AiGenerateEstimateInput = z.infer<typeof aiGenerateEstimateSchema>;
