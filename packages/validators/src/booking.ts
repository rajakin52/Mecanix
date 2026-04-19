import { z } from 'zod';

export const submitBookingRequestSchema = z.object({
  customerName: z.string().min(2).max(200),
  customerPhone: z.string().min(5).max(40),
  customerEmail: z.string().email().max(200).optional().or(z.literal('')),
  vehiclePlate: z.string().max(40).optional(),
  vehicleMake: z.string().max(100).optional(),
  vehicleModel: z.string().max(100).optional(),
  serviceType: z.string().max(100).optional(),
  catalogId: z.string().uuid().optional(),
  preferredDate: z.string(),
  preferredTime: z.string().max(20).optional(),
  notes: z.string().max(4000).optional(),
});

export const confirmBookingRequestSchema = z.object({
  scheduledStart: z.string(),
  scheduledEnd: z.string(),
  technicianId: z.string().uuid().optional(),
});

export type SubmitBookingRequestInput = z.infer<typeof submitBookingRequestSchema>;
export type ConfirmBookingRequestInput = z.infer<typeof confirmBookingRequestSchema>;
