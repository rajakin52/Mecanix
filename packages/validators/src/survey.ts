import { z } from 'zod';

export const submitSurveySchema = z.object({
  jobCardId: z.string().uuid(),
  customerId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  npsScore: z.coerce.number().int().min(0).max(10).optional(),
  feedback: z.string().max(4000).optional(),
  source: z.string().max(50).optional(),
});

export type SubmitSurveyInput = z.infer<typeof submitSurveySchema>;
