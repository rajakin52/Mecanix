export interface Invoice {
  id: string;
  tenant_id: string;
  job_card_id: string;
  invoice_number: string;
  status: string;
  labour_total: number;
  parts_total: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  is_insurance: boolean;
  customer_portion?: number;
  insurance_portion?: number;
  invoice_date?: string;
  due_date?: string;
  notes?: string;
  currency?: string;
  short_hash?: string;
  saft_document_number?: string;
  created_at: string;
  updated_at: string;
  // Joined
  customer?: { full_name: string; phone?: string; email?: string; tax_id?: string };
  job_card?: { job_number: string };
}
