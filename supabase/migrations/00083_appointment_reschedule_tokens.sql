-- ═══════════════════════════════════════════════════════════════
-- Module 19 / Phase 4 item 6 — Customer self-reschedule token.
--
-- Every appointment confirmation WhatsApp will include a
-- /public/reschedule/[token] link. The customer picks a new slot
-- themselves instead of calling the shop. One-shot tokens with a
-- 24-hour expiry window on each use — lets the same customer
-- reschedule multiple times if plans keep changing without ever
-- needing to issue a new link.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reschedule_token       text,
  ADD COLUMN IF NOT EXISTS reschedule_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reschedule_count       integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_reschedule_token
  ON public.appointments(reschedule_token)
  WHERE reschedule_token IS NOT NULL;
