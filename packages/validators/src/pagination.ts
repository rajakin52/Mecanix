import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['created_at', 'updated_at', 'full_name', 'name', 'phone', 'plate', 'job_number', 'invoice_number', 'status', 'amount', 'grand_total', 'date_opened', 'expense_date']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;
