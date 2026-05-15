-- 00124_preferred_language_overrides.sql
-- Per-customer AND per-user language overrides.
--
-- Until now every outgoing comm — SOA emails, WhatsApp templates,
-- password resets, date / currency formatting — read tenants.locale.
-- That's fine for monolingual workshops but breaks for cross-border
-- ones (Angolan workshop with Brazilian expat customers, English-
-- speaking technician, etc.). These columns let each customer / user
-- pin their own language; comms fall back to tenants.locale when null.
--
-- Allowed values match the platform's phase-1 locales (en / pt-PT / pt-BR).
-- Add more as we expand to Mozambique / French markets.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS preferred_language text
  CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'pt-PT', 'pt-BR'));

COMMENT ON COLUMN public.customers.preferred_language IS
  'ISO-style locale override for outbound comms. NULL → fall back to tenants.locale.';

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_language text
  CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'pt-PT', 'pt-BR'));

COMMENT ON COLUMN public.users.preferred_language IS
  'ISO-style locale override for password resets and back-office UI. NULL → fall back to tenants.locale.';

-- No indexes — selection is always by id, columns are purely read at
-- comms-render time.
