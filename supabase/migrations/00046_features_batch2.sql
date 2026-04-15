-- ═══════════════════════════════════════════════════════════════
-- Features Batch 2: KPIs, Discounts, Account Customers,
-- Appointment Reminders, Payment Reminders, Comeback Tracking
-- ═══════════════════════════════════════════════════════════════

-- ── 1. DISCOUNTS on line items and invoices ──
ALTER TABLE public.labour_lines
  ADD COLUMN IF NOT EXISTS discount_type text CHECK (discount_type IN ('percent', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text;

ALTER TABLE public.parts_lines
  ADD COLUMN IF NOT EXISTS discount_type text CHECK (discount_type IN ('percent', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_type text CHECK (discount_type IN ('percent', 'fixed')),
  ADD COLUMN IF NOT EXISTS discount_value numeric(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_reason text,
  ADD COLUMN IF NOT EXISTS subtotal_before_discount numeric(12,2) DEFAULT 0;

-- ── 2. ACCOUNT / CREDIT CUSTOMERS ──
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS is_account_customer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS credit_terms_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS credit_limit numeric(12,2),
  ADD COLUMN IF NOT EXISTS current_balance numeric(12,2) DEFAULT 0;

-- ── 3. APPOINTMENT REMINDERS ──
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_24h boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_1h boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_24h_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_1h_at timestamptz;

-- ── 4. PAYMENT REMINDERS (overdue invoice tracking) ──
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS payment_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

-- ── 5. COMEBACK / REWORK TRACKING ──
ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS is_comeback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comeback_original_job_id uuid REFERENCES public.job_cards(id),
  ADD COLUMN IF NOT EXISTS comeback_reason text;

CREATE INDEX IF NOT EXISTS idx_job_cards_comeback ON public.job_cards(comeback_original_job_id)
  WHERE is_comeback = true;

-- ── 6. KPI MATERIALIZED VIEW (for fast dashboard queries) ──
-- This view pre-calculates key metrics per tenant per month

CREATE OR REPLACE VIEW public.kpi_monthly AS
SELECT
  j.tenant_id,
  date_trunc('month', j.created_at)::date AS month,
  -- Car count: unique vehicles serviced
  COUNT(DISTINCT j.vehicle_id) AS car_count,
  -- Job count
  COUNT(j.id) AS job_count,
  -- Average Repair Order (ARO): total revenue / job count
  CASE WHEN COUNT(j.id) > 0
    THEN ROUND(SUM(j.grand_total) / COUNT(j.id), 2)
    ELSE 0 END AS aro,
  -- Total revenue
  SUM(j.grand_total) AS total_revenue,
  -- Total labour hours
  COALESCE(SUM(ll.total_hours), 0) AS total_labour_hours,
  -- Hours per RO
  CASE WHEN COUNT(j.id) > 0
    THEN ROUND(COALESCE(SUM(ll.total_hours), 0) / COUNT(j.id), 2)
    ELSE 0 END AS hours_per_ro,
  -- Labour revenue
  SUM(j.labour_total) AS labour_revenue,
  -- Effective labour rate (labour revenue / labour hours)
  CASE WHEN COALESCE(SUM(ll.total_hours), 0) > 0
    THEN ROUND(SUM(j.labour_total) / SUM(ll.total_hours), 2)
    ELSE 0 END AS effective_labour_rate,
  -- Comeback rate
  CASE WHEN COUNT(j.id) > 0
    THEN ROUND(COUNT(j.id) FILTER (WHERE j.is_comeback = true)::numeric / COUNT(j.id) * 100, 1)
    ELSE 0 END AS comeback_rate_pct,
  -- Invoiced count
  COUNT(j.id) FILTER (WHERE j.status = 'invoiced') AS invoiced_count
FROM public.job_cards j
LEFT JOIN LATERAL (
  SELECT SUM(hours) AS total_hours
  FROM public.labour_lines l
  WHERE l.job_card_id = j.id AND l.line_status = 'charged'
) ll ON true
WHERE j.deleted_at IS NULL
GROUP BY j.tenant_id, date_trunc('month', j.created_at)::date;

-- Close rate view (estimates sent vs approved)
CREATE OR REPLACE VIEW public.kpi_close_rate AS
SELECT
  e.tenant_id,
  date_trunc('month', e.created_at)::date AS month,
  COUNT(e.id) AS estimates_sent,
  COUNT(e.id) FILTER (WHERE e.status = 'approved') AS estimates_approved,
  CASE WHEN COUNT(e.id) > 0
    THEN ROUND(COUNT(e.id) FILTER (WHERE e.status = 'approved')::numeric / COUNT(e.id) * 100, 1)
    ELSE 0 END AS close_rate_pct
FROM public.estimates e
GROUP BY e.tenant_id, date_trunc('month', e.created_at)::date;
