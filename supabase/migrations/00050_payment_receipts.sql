-- Payment receipt numbers + receipt data
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS vehicle_plate text,
  ADD COLUMN IF NOT EXISTS invoice_number text;

-- Receipt number sequence per tenant
CREATE OR REPLACE FUNCTION public.generate_receipt_number(p_tenant_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seq int;
  v_prefix text := 'REC';
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN receipt_number ~ '^REC-[0-9]+$'
    THEN CAST(SUBSTRING(receipt_number FROM 'REC-([0-9]+)') AS int)
    ELSE 0 END
  ), 0) + 1
  INTO v_seq
  FROM public.payments
  WHERE tenant_id = p_tenant_id;

  RETURN v_prefix || '-' || LPAD(v_seq::text, 5, '0');
END;
$$;
