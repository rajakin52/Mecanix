import { z } from 'zod';

export const openRegisterSchema = z.object({
  openingFloat: z.coerce.number().min(0).default(0),
  branchId: z.string().uuid().optional(),
});

export const closeRegisterSchema = z.object({
  closingCash: z.coerce.number().min(0),
  closeNotes: z.string().max(2000).optional(),
});

export const createTransactionSchema = z.object({
  transactionType: z.enum(['payment', 'refund', 'petty_cash', 'deposit', 'adjustment', 'float']),
  paymentMethod: z.enum([
    'cash', 'card', 'mpesa', 'multicaixa', 'emola',
    'pix', 'mbway', 'multibanco', 'transfer', 'other',
  ]).default('cash'),
  amount: z.coerce.number(),
  invoiceId: z.string().uuid().optional(),
  jobCardId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  reference: z.string().max(200).optional(),
});

export const createBankDepositSchema = z.object({
  amount: z.coerce.number().min(0.01),
  bankName: z.string().min(1).max(200),
  accountNumber: z.string().max(100).optional(),
  depositReference: z.string().min(1).max(200),
  depositDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export type OpenRegisterInput = z.infer<typeof openRegisterSchema>;
export type CloseRegisterInput = z.infer<typeof closeRegisterSchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type CreateBankDepositInput = z.infer<typeof createBankDepositSchema>;
