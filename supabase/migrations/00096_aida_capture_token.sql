-- ═══════════════════════════════════════════════════════════════
-- Customer-facing capture link for a damage assessment.
--
-- Workshop generates a token, shares the public URL with the
-- customer (WhatsApp / SMS / email). Customer opens the link on
-- their phone, takes damage photos, photos land on the existing
-- damage_assessments row. No Mecanix login required.
--
-- Token lifecycle:
--   - Generated on demand by POST /aida/assessments/:id/capture-link.
--   - Re-used if still valid; otherwise a new one is issued and the
--     old URL stops working.
--   - Default TTL 14 days, anchored from creation (longer than
--     reschedule because customers sometimes photograph their car
--     days after FNOL).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.damage_assessments
  ADD COLUMN IF NOT EXISTS capture_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS capture_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_damage_assessments_capture_token
  ON public.damage_assessments(capture_token)
  WHERE capture_token IS NOT NULL;
