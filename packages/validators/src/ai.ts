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

export type AiRespondInput = z.infer<typeof aiRespondSchema>;
export type AiDiagnoseInput = z.infer<typeof aiDiagnoseSchema>;
