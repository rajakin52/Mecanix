-- ============================================================
-- MECANIX — Prevent duplicate customers and vendors
-- ============================================================

-- Customers: unique phone per tenant (primary identifier)
-- Uses partial index to only enforce on non-deleted records
CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_tenant_phone
  ON public.customers (tenant_id, phone)
  WHERE deleted_at IS NULL;

-- For vendors: first deactivate duplicates, keeping only the latest
-- Then add the unique constraint
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tenant_id, name, array_agg(id ORDER BY created_at DESC) AS ids
    FROM public.vendors
    WHERE is_active = true
    GROUP BY tenant_id, name
    HAVING count(*) > 1
  LOOP
    -- Keep the first (most recent), deactivate the rest
    UPDATE public.vendors
    SET is_active = false
    WHERE id = ANY(r.ids[2:]);
  END LOOP;
END $$;

-- Now add the unique constraint
CREATE UNIQUE INDEX uq_vendor_tenant_name
  ON public.vendors (tenant_id, name)
  WHERE is_active = true;
