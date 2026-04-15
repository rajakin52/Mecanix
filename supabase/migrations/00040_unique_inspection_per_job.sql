-- Prevent duplicate inspections per job card.
-- First, clean up any existing duplicates by keeping only the earliest one.
DELETE FROM public.vehicle_inspections a
  USING public.vehicle_inspections b
  WHERE a.job_card_id = b.job_card_id
    AND a.tenant_id   = b.tenant_id
    AND a.created_at   > b.created_at;

-- Now add the unique constraint so this can never happen again.
CREATE UNIQUE INDEX uq_one_inspection_per_job
  ON public.vehicle_inspections(job_card_id, tenant_id);
