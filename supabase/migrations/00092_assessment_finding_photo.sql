-- ═══════════════════════════════════════════════════════════════
-- Link each assessment finding to the photo that supports it, so
-- the estimator can jump to the evidence with one click.
--
-- The Claude-vision analyse() endpoint (POST /aida/assessments/:id/
-- analyse) receives a photo_index per finding; the service resolves
-- that to an assessment_photos.id and writes it here. Manual
-- findings leave this NULL.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.assessment_findings
  ADD COLUMN IF NOT EXISTS photo_id uuid
    REFERENCES public.assessment_photos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_findings_photo
  ON public.assessment_findings(tenant_id, assessment_id, photo_id)
  WHERE photo_id IS NOT NULL;
