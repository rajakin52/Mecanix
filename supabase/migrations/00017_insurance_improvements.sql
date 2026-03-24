-- Insurance Improvements — Audatex-inspired

-- Supplement estimates (additional damage found during repair)
ALTER TABLE public.claim_estimates ADD COLUMN IF NOT EXISTS is_supplement boolean NOT NULL DEFAULT false;
ALTER TABLE public.claim_estimates ADD COLUMN IF NOT EXISTS supplement_reason text;

-- Estimate line operation types (replace/repair/paint/mechanical/sublet)
ALTER TABLE public.estimate_lines ADD COLUMN IF NOT EXISTS operation_type text DEFAULT 'replace'
  CHECK (operation_type IN ('replace', 'repair', 'paint', 'mechanical', 'sublet'));
ALTER TABLE public.estimate_lines ADD COLUMN IF NOT EXISTS labor_hours numeric(6,2);
ALTER TABLE public.estimate_lines ADD COLUMN IF NOT EXISTS labor_rate numeric(10,2);
ALTER TABLE public.estimate_lines ADD COLUMN IF NOT EXISTS parts_cost numeric(10,2);
ALTER TABLE public.estimate_lines ADD COLUMN IF NOT EXISTS parts_source text DEFAULT 'oem'
  CHECK (parts_source IN ('oem', 'aftermarket', 'used', 'recycled'));

-- Auto-approval rules per insurance company
CREATE TABLE IF NOT EXISTS public.approval_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_company_id  uuid NOT NULL REFERENCES public.insurance_companies(id),
  rule_type             text NOT NULL CHECK (rule_type IN ('auto_approve_threshold', 'labor_rate_cap', 'parts_rule', 'supplement_limit', 'total_loss_threshold')),
  value                 numeric(12,2) NOT NULL,
  description           text,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_rules ON public.approval_rules(insurance_company_id, rule_type);

-- Total loss tracking
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS vehicle_value numeric(12,2);
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS is_total_loss boolean DEFAULT false;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS total_loss_ratio numeric(5,2);

-- Document/license renewal reminders
CREATE TABLE IF NOT EXISTS public.document_reminders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  vehicle_id      uuid REFERENCES public.vehicles(id),
  customer_id     uuid REFERENCES public.customers(id),
  document_type   text NOT NULL CHECK (document_type IN ('vehicle_license', 'insurance_policy', 'inspection_certificate', 'driving_license', 'road_tax', 'other')),
  document_name   text NOT NULL,
  expiry_date     date NOT NULL,
  reminder_days   integer NOT NULL DEFAULT 30,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'reminded', 'renewed', 'expired')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_doc_reminders_tenant ON public.document_reminders(tenant_id);
CREATE INDEX idx_doc_reminders_expiry ON public.document_reminders(tenant_id, expiry_date) WHERE status = 'active';

CREATE TRIGGER doc_reminders_updated_at
  BEFORE UPDATE ON public.document_reminders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.document_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doc_reminders_select" ON public.document_reminders FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "doc_reminders_insert" ON public.document_reminders FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "doc_reminders_update" ON public.document_reminders FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Petty cash
CREATE TABLE IF NOT EXISTS public.petty_cash (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal')),
  amount          numeric(12,2) NOT NULL,
  description     text NOT NULL,
  category        text,
  reference       text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_petty_cash_tenant ON public.petty_cash(tenant_id);

ALTER TABLE public.petty_cash ENABLE ROW LEVEL SECURITY;
CREATE POLICY "petty_cash_select" ON public.petty_cash FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "petty_cash_insert" ON public.petty_cash FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
