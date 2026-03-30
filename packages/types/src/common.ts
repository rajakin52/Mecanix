export interface Reminder {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  service_name: string;
  due_date?: string;
  due_mileage?: number;
  status: string;
  created_at: string;
}

export interface DocumentReminder {
  id: string;
  tenant_id: string;
  vehicle_id: string;
  document_type: string;
  expiry_date: string;
  status: string;
  notes?: string;
  created_at: string;
}

export interface GatePass {
  id: string;
  tenant_id: string;
  job_card_id: string;
  pass_number: string;
  type: string;
  mileage?: number;
  authorized_by?: string;
  notes?: string;
  created_at: string;
}

export interface DeferredSummary {
  total_pending: number;
  red_count: number;
  yellow_count: number;
  potential_revenue: number;
}

export interface TimeEntry {
  id: string;
  tenant_id: string;
  technician_id: string;
  job_card_id?: string;
  clock_in: string;
  clock_out?: string;
  hours?: number;
  notes?: string;
  created_at: string;
}
