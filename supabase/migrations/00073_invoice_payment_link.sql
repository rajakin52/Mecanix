-- ═══════════════════════════════════════════════════════════════
-- Module 18 / Phase 1 — Payment links on invoices.
--
-- Add a random public token per invoice so the shop can send a
-- tokenised URL over WhatsApp / SMS / email that opens a public
-- /pay page (no auth) showing balance_due and pay options. The
-- token is rotatable so an accidentally-leaked link can be
-- invalidated and a fresh one regenerated.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS public_pay_token       text,
  ADD COLUMN IF NOT EXISTS public_pay_expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS public_pay_created_at  timestamptz;

-- Token lookup has to be fast and unique when present. Partial
-- unique index tolerates NULLs on draft/cancelled invoices.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_public_pay_token
  ON public.invoices(public_pay_token)
  WHERE public_pay_token IS NOT NULL;
