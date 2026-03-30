export interface JobCard {
  id: string;
  tenant_id: string;
  job_number: string;
  customer_id: string;
  vehicle_id: string;
  primary_technician_id?: string;
  status: string;
  reported_problem: string;
  internal_notes?: string;
  date_opened: string;
  estimated_completion?: string;
  is_insurance: boolean;
  is_taxable: boolean;
  labels: string[];
  labour_total: number;
  parts_total: number;
  tax_rate: number;
  tax_amount: number;
  grand_total: number;
  current_estimate_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Joined relations (optional, from select queries)
  customer?: { full_name: string; phone: string; email?: string; tax_id?: string };
  vehicle?: { plate: string; make: string; model: string; year?: number };
  primary_technician?: { full_name: string } | null;
  status_history?: Array<{ status: string; changed_at: string; changed_by_name?: string; notes?: string }>;
}
