import { z } from 'zod';

// Generous cap for base64-encoded photos: ~15MB decoded (~20MB base64)
const MAX_BASE64_LEN = 20_000_000;

export const createPhotoCaptureSessionSchema = z.object({
  jobCardId: z.string().uuid().optional(),
  vehiclePlate: z.string().max(40).optional(),
  vehicleInfo: z.string().max(200).optional(),
  requiredPhotos: z.array(z.string().max(50)).max(20).optional(),
  captureMode: z.enum(['camera', 'gallery']).optional(),
  channel: z.enum(['whatsapp', 'sms']).optional(),
  sendWhatsApp: z.string().min(5).max(40).optional(),
  sendSms: z.string().min(5).max(40).optional(),
});

export const createSignatureSessionSchema = z.object({
  jobCardId: z.string().uuid().optional(),
  customerName: z.string().max(200).optional(),
  vehiclePlate: z.string().max(40).optional(),
  vehicleInfo: z.string().max(200).optional(),
  sendWhatsApp: z.string().min(5).max(40).optional(),
  sendSms: z.string().min(5).max(40).optional(),
  channel: z.enum(['whatsapp', 'sms']).optional(),
});

export const linkSessionToJobSchema = z.object({
  jobCardId: z.string().uuid(),
});

export const directPhotoUploadSchema = z.object({
  jobId: z.string().uuid(),
  photoType: z.string().min(1).max(50),
  base64Data: z.string().min(10).max(MAX_BASE64_LEN),
  fileName: z.string().max(500).optional(),
});

export const publicPhotoUploadSchema = z.object({
  photoType: z.string().min(1).max(50),
  storageUrl: z.string().url().max(2000).optional(),
  base64Data: z.string().min(10).max(MAX_BASE64_LEN).optional(),
  fileName: z.string().max(500).optional(),
  fileSize: z.coerce.number().int().min(0).max(100_000_000).optional(),
}).refine(
  (v) => !!v.storageUrl || !!v.base64Data,
  { message: 'Either storageUrl or base64Data is required' },
);

export const publicSignatureUploadSchema = z.object({
  base64Data: z.string().min(10).max(MAX_BASE64_LEN),
});

export type CreatePhotoCaptureSessionInput = z.infer<typeof createPhotoCaptureSessionSchema>;
export type CreateSignatureSessionInput = z.infer<typeof createSignatureSessionSchema>;
export type LinkSessionToJobInput = z.infer<typeof linkSessionToJobSchema>;
export type DirectPhotoUploadInput = z.infer<typeof directPhotoUploadSchema>;
export type PublicPhotoUploadInput = z.infer<typeof publicPhotoUploadSchema>;
export type PublicSignatureUploadInput = z.infer<typeof publicSignatureUploadSchema>;
