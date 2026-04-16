-- ═══════════════════════════════════════════════════════════════
-- Features Batch 3: Fleet, CRM, Technician, Health Score,
-- Public Job Status, DVI Gate, Warranty, Priority
-- ═══════════════════════════════════════════════════════════════

-- ── 1. FLEET MANAGEMENT ──

CREATE TABLE public.fleets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  company_name    text,
  contact_name    text,
  contact_phone   text,
  contact_email   text,
  customer_id     uuid REFERENCES public.customers(id),
  monthly_budget  numeric(12,2),
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_fleets_tenant ON public.fleets(tenant_id);

ALTER TABLE public.fleets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleets_select" ON public.fleets FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "fleets_insert" ON public.fleets FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "fleets_update" ON public.fleets FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Link vehicles to fleets
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fleet_id uuid REFERENCES public.fleets(id);

-- Fleet PM schedules
CREATE TABLE public.fleet_pm_schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fleet_id        uuid NOT NULL REFERENCES public.fleets(id) ON DELETE CASCADE,
  name            text NOT NULL,           -- e.g. '10,000km Service'
  catalog_id      uuid REFERENCES public.repair_catalog(id),
  mileage_interval integer,               -- every X km
  time_interval_days integer,             -- every X days
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fleet_pm_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fleet_pm_select" ON public.fleet_pm_schedules FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "fleet_pm_insert" ON public.fleet_pm_schedules FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "fleet_pm_update" ON public.fleet_pm_schedules FOR UPDATE USING (tenant_id = public.get_tenant_id());


-- ── 2. CRM: CUSTOMER TAGS + SATISFACTION ──

CREATE TABLE public.customer_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag         text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, customer_id, tag)
);

CREATE INDEX idx_customer_tags_customer ON public.customer_tags(customer_id);
CREATE INDEX idx_customer_tags_tag ON public.customer_tags(tenant_id, tag);

ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_tags_select" ON public.customer_tags FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "customer_tags_insert" ON public.customer_tags FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "customer_tags_delete" ON public.customer_tags FOR DELETE USING (tenant_id = public.get_tenant_id());

-- Satisfaction surveys
CREATE TABLE public.satisfaction_surveys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id),
  customer_id     uuid NOT NULL REFERENCES public.customers(id),
  rating          integer NOT NULL CHECK (rating BETWEEN 1 AND 5),  -- 1-5 stars
  nps_score       integer CHECK (nps_score BETWEEN 0 AND 10),        -- 0-10 NPS
  feedback        text,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  source          text DEFAULT 'whatsapp' CHECK (source IN ('whatsapp', 'app', 'web', 'manual')),
  UNIQUE(job_card_id)  -- one survey per job
);

ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "surveys_select" ON public.satisfaction_surveys FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "surveys_insert" ON public.satisfaction_surveys FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

-- Customer lifetime value (computed column via view)
CREATE OR REPLACE VIEW public.customer_lifetime_value AS
SELECT
  c.id AS customer_id,
  c.tenant_id,
  COUNT(DISTINCT j.id) AS total_jobs,
  COALESCE(SUM(j.grand_total), 0) AS total_revenue,
  MIN(j.created_at) AS first_visit,
  MAX(j.created_at) AS last_visit,
  ROUND(AVG(COALESCE(ss.rating, 0))::numeric, 1) AS avg_rating
FROM public.customers c
LEFT JOIN public.job_cards j ON j.customer_id = c.id AND j.deleted_at IS NULL
LEFT JOIN public.satisfaction_surveys ss ON ss.customer_id = c.id
GROUP BY c.id, c.tenant_id;


-- ── 3. TECHNICIAN ENHANCEMENTS ──

ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS book_rate numeric(10,2),          -- flat rate per book hour
  ADD COLUMN IF NOT EXISTS pay_type text DEFAULT 'hourly'
    CHECK (pay_type IN ('hourly', 'flat_rate', 'commission', 'salary'));

ALTER TABLE public.labour_lines
  ADD COLUMN IF NOT EXISTS book_hours numeric(6,2);          -- standard/book time (vs actual hours)

CREATE TABLE public.technician_certifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  technician_id   uuid NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  name            text NOT NULL,
  issuer          text,
  cert_number     text,
  issued_date     date,
  expiry_date     date,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.technician_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_certs_select" ON public.technician_certifications FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "tech_certs_insert" ON public.technician_certifications FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "tech_certs_update" ON public.technician_certifications FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Technician efficiency view
CREATE OR REPLACE VIEW public.technician_efficiency AS
SELECT
  t.id AS technician_id,
  t.tenant_id,
  t.full_name,
  COUNT(DISTINCT l.job_card_id) AS jobs_worked,
  ROUND(SUM(l.hours)::numeric, 1) AS actual_hours,
  ROUND(SUM(COALESCE(l.book_hours, l.hours))::numeric, 1) AS book_hours,
  CASE WHEN SUM(l.hours) > 0
    THEN ROUND(SUM(COALESCE(l.book_hours, l.hours)) / SUM(l.hours) * 100, 1)
    ELSE 0 END AS efficiency_pct
FROM public.technicians t
LEFT JOIN public.labour_lines l ON l.technician_id = t.id AND l.line_status = 'charged'
GROUP BY t.id, t.tenant_id, t.full_name;


-- ── 4. VEHICLE HEALTH SCORE (from DVI) ──

ALTER TABLE public.vehicle_inspections
  ADD COLUMN IF NOT EXISTS health_score integer;  -- 0-100

-- Function to calculate health score from DVI items
CREATE OR REPLACE FUNCTION public.calculate_health_score(p_inspection_id uuid)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_total int;
  v_green int;
  v_yellow int;
  v_red int;
  v_score int;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'green'),
    COUNT(*) FILTER (WHERE status = 'yellow'),
    COUNT(*) FILTER (WHERE status = 'red')
  INTO v_total, v_green, v_yellow, v_red
  FROM public.inspection_items
  WHERE inspection_id = p_inspection_id;

  IF v_total = 0 THEN RETURN NULL; END IF;

  -- Score: green=100, yellow=50, red=0, not_inspected excluded
  v_score := ROUND(
    (v_green * 100.0 + v_yellow * 50.0) / NULLIF(v_green + v_yellow + v_red, 0)
  );

  -- Update the inspection record
  UPDATE public.vehicle_inspections SET health_score = v_score WHERE id = p_inspection_id;

  RETURN v_score;
END;
$$;


-- ── 5. PUBLIC JOB STATUS PAGE ──

ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS public_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS public_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_job_cards_public_token ON public.job_cards(public_token)
  WHERE public_token IS NOT NULL;


-- ── 6. WARRANTY JOB TRACKING ──

ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS is_warranty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_type text CHECK (warranty_type IN ('parts', 'labour', 'full', 'oem')),
  ADD COLUMN IF NOT EXISTS warranty_claim_ref text,
  ADD COLUMN IF NOT EXISTS warranty_supplier text;


-- ── 7. JOB PRIORITY SCORING ──

ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS priority_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS priority_level text DEFAULT 'normal'
    CHECK (priority_level IN ('low', 'normal', 'high', 'urgent'));
