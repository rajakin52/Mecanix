-- ═══════════════════════════════════════════════════════════════
-- Module 19 / Phase 4 item 5 — Review flywheel.
--
-- NPS 9 / 10 respondents are the ones who'll actually leave a
-- Google review — if you ask them at the right moment. We schedule
-- a follow-up WhatsApp 24 hours after the survey arrives, and
-- track the click-through so the shop can see the flywheel
-- working without guesswork.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.satisfaction_surveys
  ADD COLUMN IF NOT EXISTS review_prompt_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_prompt_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS review_prompt_token        text UNIQUE,
  ADD COLUMN IF NOT EXISTS review_click_at            timestamptz;

CREATE INDEX IF NOT EXISTS idx_surveys_review_prompt_due
  ON public.satisfaction_surveys(review_prompt_scheduled_at)
  WHERE review_prompt_sent_at IS NULL AND review_prompt_scheduled_at IS NOT NULL;
