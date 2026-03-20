-- ============================================================
-- MECANIX Sprint 3 — Job Cards, Labour, Parts, Technicians
-- ============================================================

-- ============================================================
-- TECHNICIANS
-- ============================================================
CREATE TABLE public.technicians (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES public.users(id),
  full_name       text NOT NULL,
  phone           text,
  specializations text[] NOT NULL DEFAULT '{}',
  hourly_rate     numeric(10,2),
  is_active       boolean NOT NULL DEFAULT true,
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),
  updated_by      uuid REFERENCES public.users(id)
);

CREATE INDEX idx_technicians_tenant ON public.technicians(tenant_id);

CREATE TRIGGER technicians_updated_at
  BEFORE UPDATE ON public.technicians
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "technicians_select" ON public.technicians
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "technicians_insert" ON public.technicians
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "technicians_update" ON public.technicians
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- JOB CARDS
-- ============================================================
CREATE TABLE public.job_cards (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_number            text NOT NULL,
  vehicle_id            uuid NOT NULL REFERENCES public.vehicles(id),
  customer_id           uuid NOT NULL REFERENCES public.customers(id),

  -- Status
  status                text NOT NULL DEFAULT 'received' CHECK (status IN (
    'received', 'diagnosing', 'awaiting_approval', 'insurance_review',
    'in_progress', 'awaiting_parts', 'quality_check', 'ready', 'invoiced'
  )),

  -- Dates
  date_opened           timestamptz NOT NULL DEFAULT NOW(),
  estimated_completion  timestamptz,
  date_closed           timestamptz,

  -- Problem & Notes
  reported_problem      text,
  internal_notes        text,
  customer_remarks      text,

  -- Assignment
  primary_technician_id uuid REFERENCES public.technicians(id),
  service_writer_id     uuid REFERENCES public.users(id),

  -- Toggles
  is_insurance          boolean NOT NULL DEFAULT false,
  is_taxable            boolean NOT NULL DEFAULT true,
  requires_authorization boolean NOT NULL DEFAULT false,
  is_authorized         boolean NOT NULL DEFAULT false,
  authorization_date    timestamptz,

  -- Insurance fields (nullable, used when is_insurance = true)
  insurance_company     text,
  policy_number         text,
  claim_reference       text,
  excess_amount         numeric(12,2),

  -- Parts issuing mode
  parts_issuing_mode    text NOT NULL DEFAULT 'auto' CHECK (parts_issuing_mode IN ('auto', 'manual')),

  -- Labels/tags
  labels                text[] NOT NULL DEFAULT '{}',

  -- Estimate footer (per job, defaults from tenant settings)
  estimate_footer       text,

  -- Photos
  photos                text[] NOT NULL DEFAULT '{}',

  -- Totals (calculated)
  labour_total          numeric(12,2) NOT NULL DEFAULT 0,
  parts_total           numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount            numeric(12,2) NOT NULL DEFAULT 0,
  grand_total           numeric(12,2) NOT NULL DEFAULT 0,

  -- Metadata
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),
  created_by            uuid REFERENCES public.users(id),
  updated_by            uuid REFERENCES public.users(id),
  deleted_at            timestamptz,
  deleted_by            uuid REFERENCES public.users(id),

  CONSTRAINT uq_job_number UNIQUE (tenant_id, job_number)
);

CREATE INDEX idx_job_cards_tenant ON public.job_cards(tenant_id);
CREATE INDEX idx_job_cards_status ON public.job_cards(tenant_id, status);
CREATE INDEX idx_job_cards_vehicle ON public.job_cards(tenant_id, vehicle_id);
CREATE INDEX idx_job_cards_customer ON public.job_cards(tenant_id, customer_id);
CREATE INDEX idx_job_cards_technician ON public.job_cards(tenant_id, primary_technician_id);
CREATE INDEX idx_job_cards_number ON public.job_cards(tenant_id, job_number);

CREATE TRIGGER job_cards_updated_at
  BEFORE UPDATE ON public.job_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.job_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_cards_select" ON public.job_cards
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "job_cards_insert" ON public.job_cards
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "job_cards_update" ON public.job_cards
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "job_cards_delete" ON public.job_cards
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- JOB STATUS HISTORY (audit trail)
-- ============================================================
CREATE TABLE public.job_status_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id uuid NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  from_status text,
  to_status   text NOT NULL,
  changed_by  uuid REFERENCES public.users(id),
  notes       text,
  changed_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_job_status_history_job ON public.job_status_history(job_card_id);

ALTER TABLE public.job_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_status_history_select" ON public.job_status_history
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "job_status_history_insert" ON public.job_status_history
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- ============================================================
-- LABOUR LINES
-- ============================================================
CREATE TABLE public.labour_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  description     text NOT NULL,
  hours           numeric(6,2) NOT NULL DEFAULT 0,
  rate            numeric(10,2) NOT NULL DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  technician_id   uuid REFERENCES public.technicians(id),
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_labour_lines_job ON public.labour_lines(job_card_id);

CREATE TRIGGER labour_lines_updated_at
  BEFORE UPDATE ON public.labour_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.labour_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "labour_lines_select" ON public.labour_lines
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "labour_lines_insert" ON public.labour_lines
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "labour_lines_update" ON public.labour_lines
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "labour_lines_delete" ON public.labour_lines
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- PARTS LINES
-- ============================================================
CREATE TABLE public.parts_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  part_name       text NOT NULL,
  part_number     text,
  quantity        numeric(8,2) NOT NULL DEFAULT 1,
  unit_cost       numeric(10,2) NOT NULL DEFAULT 0,
  markup_pct      numeric(5,2) NOT NULL DEFAULT 0,
  sell_price      numeric(10,2) NOT NULL DEFAULT 0,
  subtotal        numeric(12,2) NOT NULL DEFAULT 0,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parts_lines_job ON public.parts_lines(job_card_id);

CREATE TRIGGER parts_lines_updated_at
  BEFORE UPDATE ON public.parts_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.parts_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parts_lines_select" ON public.parts_lines
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "parts_lines_insert" ON public.parts_lines
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "parts_lines_update" ON public.parts_lines
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "parts_lines_delete" ON public.parts_lines
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- Auto-generate job number function
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_job_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  next_num integer;
  job_num text;
BEGIN
  SELECT COALESCE(MAX(
    CAST(NULLIF(regexp_replace(job_number, '[^0-9]', '', 'g'), '') AS integer)
  ), 0) + 1
  INTO next_num
  FROM public.job_cards
  WHERE tenant_id = p_tenant_id;

  job_num := 'JC-' || LPAD(next_num::text, 5, '0');
  RETURN job_num;
END;
$$;
