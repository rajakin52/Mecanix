-- 00123_credit_terms_default_zero.sql
-- Change the customer credit-terms default from 30 days to 0
-- (= "due on receipt"). The workshop convention is to bill at
-- pickup; the 30-day default was inherited from a generic SaaS
-- template and never matched the real workflow.
--
-- New customers default to 0. Existing customers are flipped from
-- the inherited 30 to 0 — no UI exposed the field as a deliberate
-- choice on those rows, so they're effectively still on the default.
-- Workshops that explicitly want net-N terms for specific customers
-- can set it on the customer profile.

ALTER TABLE public.customers
  ALTER COLUMN credit_terms_days SET DEFAULT 0;

UPDATE public.customers
   SET credit_terms_days = 0
 WHERE credit_terms_days = 30;
