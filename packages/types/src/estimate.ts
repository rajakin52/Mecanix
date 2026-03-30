export interface Estimate {
  id: string;
  tenant_id: string;
  job_card_id: string;
  estimate_number: string;
  version: number;
  status: string;
  labour_total: number;
  parts_total: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  labour_lines_snapshot: unknown[];
  parts_lines_snapshot: unknown[];
  dvi_snapshot?: unknown[];
  is_revision: boolean;
  change_summary?: string;
  terms?: string;
  valid_until?: string;
  sent_at?: string;
  approved_at?: string;
  rejected_at?: string;
  approval_method?: string;
  approval_notes?: string;
  signature_url?: string;
  created_at: string;
  created_by?: string;
}
