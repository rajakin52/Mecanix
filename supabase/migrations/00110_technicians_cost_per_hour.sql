-- ═══════════════════════════════════════════════════════════════
-- Technician cost per hour — feeds the job-card Profitability
-- panel so labour can be costed properly. `hourly_rate` is what
-- the customer is billed; `cost_per_hour` is what the technician
-- actually costs the workshop. Distinct because a technician
-- billed at 15,000 AOA/h might cost the workshop 6,000 AOA/h
-- (salary + payroll + overheads).
--
-- Nullable: existing technicians keep an unknown cost until the
-- workshop fills it in. The Profitability card already handles
-- the "not tracked" fallback.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS cost_per_hour numeric(10,2);

COMMENT ON COLUMN public.technicians.cost_per_hour IS
  'Internal labour cost per hour for margin calculations. Distinct '
  'from hourly_rate, which is the price billed to the customer.';

NOTIFY pgrst, 'reload schema';
