import { z } from 'zod';

export const createAppointmentSchema = z.object({
  customerId: z.string().uuid().optional(),
  vehicleId: z.string().uuid().optional(),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().min(1),
  durationMinutes: z.coerce.number().min(15).default(60),
  serviceType: z.string().min(1),
  description: z.string().optional(),
  technicianId: z.string().uuid().optional(),
  bayNumber: z.coerce.number().min(1).optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial();

export const changeAppointmentStatusSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type ChangeAppointmentStatusInput = z.infer<typeof changeAppointmentStatusSchema>;
