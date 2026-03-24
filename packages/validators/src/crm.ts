import { z } from 'zod';

export const createLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.enum(['walk_in', 'phone', 'whatsapp', 'referral', 'website', 'social_media', 'other']).optional(),
  serviceInterest: z.string().optional(),
  vehicleInfo: z.string().optional(),
  estimatedValue: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  nextFollowUp: z.string().optional(),
  customerId: z.string().uuid().optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

export const changeLeadStatusSchema = z.object({
  status: z.enum(['new', 'contacted', 'quoted', 'won', 'lost']),
});

export const createActivitySchema = z.object({
  leadId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  activityType: z.enum(['call', 'whatsapp', 'email', 'visit', 'quote', 'follow_up', 'note']),
  description: z.string().min(1),
  outcome: z.string().optional(),
  nextFollowUp: z.string().optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ChangeLeadStatusInput = z.infer<typeof changeLeadStatusSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
