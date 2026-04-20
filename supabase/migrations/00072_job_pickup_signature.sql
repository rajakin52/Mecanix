-- ═══════════════════════════════════════════════════════════════
-- Module 18 / Phase 1 — Customer pickup signature.
--
-- The drop-off signature is captured via photo_capture_sessions
-- (+ the /sign/[token] route). The mirror moment at pickup has
-- no equivalent: once the job hits 'ready', the receptionist
-- hands the keys back, but nobody signs for the vehicle and the
-- work invoice. That's a legal exposure on damage-on-collection
-- claims and it kills traceability for insurance jobs.
--
-- Store the signature inline on job_cards (same pattern as
-- vehicle_inspections.customer_signature — a data URL is small
-- enough). Capture who signed, when, and an optional mileage_out
-- snapshot so the handover row can stand on its own.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS pickup_signature_url text,
  ADD COLUMN IF NOT EXISTS pickup_signed_name   text,
  ADD COLUMN IF NOT EXISTS pickup_signed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_signed_by     uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS pickup_mileage_out   integer;

CREATE INDEX IF NOT EXISTS idx_job_cards_pickup_signed_at
  ON public.job_cards(pickup_signed_at)
  WHERE pickup_signed_at IS NOT NULL;
