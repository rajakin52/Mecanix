-- ═══════════════════════════════════════════════════════════════
-- Standalone Estimates — estimates can exist without a job card
-- Created first, converted to job card upon customer approval
-- ═══════════════════════════════════════════════════════════════

-- 1. Make job_card_id nullable (standalone estimates have no job card)
ALTER TABLE public.estimates ALTER COLUMN job_card_id DROP NOT NULL;

-- 2. Add direct customer/vehicle references (not via job card)
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS vehicle_id  uuid REFERENCES public.vehicles(id);

-- 3. Source discriminator: standalone vs job_card
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'job_card'
    CHECK (source IN ('standalone', 'job_card'));

-- 4. Track which job card was created from a standalone estimate
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS converted_job_card_id uuid REFERENCES public.job_cards(id);

-- 5. Reported problem (for standalone — normally lives on job card)
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS reported_problem text;

-- 6. Backfill customer_id/vehicle_id from existing job-linked estimates
UPDATE public.estimates e
SET customer_id = j.customer_id,
    vehicle_id  = j.vehicle_id
FROM public.job_cards j
WHERE e.job_card_id = j.id
  AND e.customer_id IS NULL;

-- 7. Constraint: standalone estimates must have customer + vehicle
ALTER TABLE public.estimates
  ADD CONSTRAINT chk_estimate_has_context CHECK (
    (job_card_id IS NOT NULL) OR (customer_id IS NOT NULL AND vehicle_id IS NOT NULL)
  );

-- 8. Indexes for new query patterns
CREATE INDEX IF NOT EXISTS idx_estimates_customer ON public.estimates(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_estimates_vehicle  ON public.estimates(tenant_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_estimates_source   ON public.estimates(tenant_id, source);
