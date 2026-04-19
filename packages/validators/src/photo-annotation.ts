import { z } from 'zod';

export const annotationSchema = z.object({
  type: z.enum(['circle', 'arrow', 'text', 'rectangle']),
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  color: z.string().max(40),
  text: z.string().max(500).optional(),
});

export const createPhotoAnnotationSchema = z.object({
  photoUrl: z.string().url().max(2000),
  annotations: z.array(annotationSchema).max(200),
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
});

export const updatePhotoAnnotationSchema = z.object({
  annotations: z.array(annotationSchema).max(200),
});

export type AnnotationInput = z.infer<typeof annotationSchema>;
export type CreatePhotoAnnotationInput = z.infer<typeof createPhotoAnnotationSchema>;
export type UpdatePhotoAnnotationInput = z.infer<typeof updatePhotoAnnotationSchema>;
