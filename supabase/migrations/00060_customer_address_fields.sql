-- Add structured address fields to customers
-- The existing 'address' text column stays for backward compatibility (free-text fallback)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS address_street  text,
  ADD COLUMN IF NOT EXISTS address_city    text,
  ADD COLUMN IF NOT EXISTS address_state   text,
  ADD COLUMN IF NOT EXISTS address_postal  text,
  ADD COLUMN IF NOT EXISTS address_country text;
