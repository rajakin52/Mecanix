-- ═══════════════════════════════════════════════════════════════
-- Allow insurance claims to exist before a job card is opened.
--
-- The original schema required every claim to be attached to a job
-- card at creation. The spec now treats AIDA as a standalone flow:
--   assessment → (optional) claim → (optional) job card
-- so a claim must be allowed to live on its own. Relaxing the NOT
-- NULL constraint is additive — every existing row already has a
-- job card, so no data migration is needed.
--
-- The index on job_card_id is replaced with a partial index (only
-- non-null rows) so we don't waste pages indexing NULL entries for
-- standalone claims.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.insurance_claims
  ALTER COLUMN job_card_id DROP NOT NULL;

DROP INDEX IF EXISTS public.idx_claims_job;
CREATE INDEX idx_claims_job
  ON public.insurance_claims(job_card_id)
  WHERE job_card_id IS NOT NULL;
