import { z } from 'zod';

// Bays
export const createBaySchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().max(50).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export const updateBaySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.string().max(50).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

// Vehicle makes/models (global)
export const addMakeSchema = z.object({
  name: z.string().min(1).max(100),
  country: z.string().max(100).optional(),
});

export const addModelSchema = z.object({
  name: z.string().min(1).max(100),
  bodyType: z.string().max(50).optional(),
});

// Customer tags
export const addCustomerTagSchema = z.object({
  tag: z.string().min(1).max(100),
});

// Canned notes
export const createCannedNoteSchema = z.object({
  category: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(8000),
});

// Job messages
export const sendJobMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  senderName: z.string().min(1).max(200),
  senderRole: z.string().min(1).max(50),
  photoUrl: z.string().url().max(2000).optional(),
});

// Data requests (GDPR)
export const createDataRequestSchema = z.object({
  customerId: z.string().uuid(),
  requestType: z.enum(['export', 'delete', 'rectification']),
});

export const completeDataRequestSchema = z.object({
  exportUrl: z.string().url().max(2000).optional(),
});

// Discovery (public rating)
export const submitWorkshopRatingSchema = z.object({
  customerId: z.string().uuid(),
  jobCardId: z.string().uuid().optional(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  review: z.string().max(4000).optional(),
});

export const replyToRatingSchema = z.object({
  reply: z.string().min(1).max(4000),
});

// Jobs: split
export const splitJobSchema = z.object({
  label: z.string().min(1).max(200),
  technicianId: z.string().uuid().optional(),
});

// Stock policy
export const updateStockPolicySchema = z.object({
  allowNegativeStock: z.boolean().optional(),
  overrideRoles: z.array(z.string().max(50)).max(20).optional(),
});

// Estimates extras
export const createJobEstimateSchema = z.object({
  terms: z.string().max(8000).optional(),
  validUntil: z.string().datetime().optional(),
});

export const sendEstimateSchema = z.object({
  channels: z.array(z.enum(['print', 'whatsapp', 'email', 'sms', 'push'])).min(1).max(10),
});

export const autoConvertDviSchema = z.object({
  inspectionId: z.string().uuid(),
});

// Deferred services
export const createDeferredServiceSchema = z.object({
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  description: z.string().min(1).max(4000),
  estimatedCost: z.coerce.number().min(0).optional(),
  priority: z.enum(['low', 'normal', 'high']).optional(),
  followUpDate: z.string().datetime().optional(),
});

export const convertDeferredSchema = z.object({
  jobCardId: z.string().uuid(),
});

export type CreateBayInput = z.infer<typeof createBaySchema>;
export type UpdateBayInput = z.infer<typeof updateBaySchema>;
export type AddMakeInput = z.infer<typeof addMakeSchema>;
export type AddModelInput = z.infer<typeof addModelSchema>;
export type AddCustomerTagInput = z.infer<typeof addCustomerTagSchema>;
export type CreateCannedNoteInput = z.infer<typeof createCannedNoteSchema>;
export type SendJobMessageInput = z.infer<typeof sendJobMessageSchema>;
export type CreateDataRequestInput = z.infer<typeof createDataRequestSchema>;
export type CompleteDataRequestInput = z.infer<typeof completeDataRequestSchema>;
export type SubmitWorkshopRatingInput = z.infer<typeof submitWorkshopRatingSchema>;
export type ReplyToRatingInput = z.infer<typeof replyToRatingSchema>;
export type SplitJobInput = z.infer<typeof splitJobSchema>;
export type UpdateStockPolicyInput = z.infer<typeof updateStockPolicySchema>;
export type CreateJobEstimateInput = z.infer<typeof createJobEstimateSchema>;
export type SendEstimateInput = z.infer<typeof sendEstimateSchema>;
export type AutoConvertDviInput = z.infer<typeof autoConvertDviSchema>;
export type CreateDeferredServiceInput = z.infer<typeof createDeferredServiceSchema>;
export type ConvertDeferredInput = z.infer<typeof convertDeferredSchema>;
