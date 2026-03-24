-- ============================================================
-- Phase 2 Quick Fixes
-- ============================================================

-- 1. Customer payment terms
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS payment_terms text;

-- 2. Vendor tax_id column
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS tax_id text;
