import { z } from 'zod';

const MAX_BASE64_LEN = 20_000_000;

export const fileUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  base64: z.string().min(1).max(MAX_BASE64_LEN),
});

export const csvUploadSchema = z.object({
  csvContent: z.string().min(1).max(MAX_BASE64_LEN),
});

export const photoUploadSchema = z.object({
  file: z.string().min(1).max(MAX_BASE64_LEN),
  filename: z.string().min(1).max(255),
});

export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type CsvUploadInput = z.infer<typeof csvUploadSchema>;
export type PhotoUploadInput = z.infer<typeof photoUploadSchema>;
