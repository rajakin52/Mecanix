-- ═══════════════════════════════════════════════════════════════
-- Atomic parts-line creation with stock deduction
-- Wraps the previously 5-step flow (insert line → fetch part →
-- update parts.stock_qty → update warehouse_stock → insert
-- inventory_adjustments → update line status) into a single
-- transaction so concurrent creates can no longer corrupt stock.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_parts_line_atomic(
  p_tenant_id uuid,
  p_job_card_id uuid,
  p_user_id uuid,
  p_part_name text,
  p_part_number text,
  p_quantity numeric,
  p_unit_cost numeric,
  p_markup_pct numeric,
  p_sell_price numeric,
  p_subtotal numeric,
  p_allow_negative boolean,
  p_original_markup_pct numeric DEFAULT NULL,
  p_price_overridden boolean DEFAULT false
)
RETURNS public.parts_lines
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_part        public.parts%ROWTYPE;
  v_available   numeric;
  v_new_stock   numeric;
  v_line        public.parts_lines%ROWTYPE;
  v_plate       text;
  v_has_part    boolean := false;
BEGIN
  -- 1. Look up the part by number (if provided) and lock it for update.
  IF p_part_number IS NOT NULL AND length(trim(p_part_number)) > 0 THEN
    SELECT *
      INTO v_part
      FROM public.parts
     WHERE tenant_id = p_tenant_id
       AND part_number = p_part_number
     LIMIT 1
       FOR UPDATE;

    v_has_part := FOUND;
  END IF;

  -- 2. Stock policy check. The application decides whether override is
  -- allowed and passes the boolean in; we just enforce it.
  IF v_has_part THEN
    v_available := COALESCE(v_part.stock_qty, 0) - COALESCE(v_part.reserved_qty, 0);

    IF v_available < p_quantity AND NOT p_allow_negative THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK: part=% available=% required=%',
        p_part_name, v_available, p_quantity
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 3. Insert the parts_line.
  INSERT INTO public.parts_lines (
    tenant_id, job_card_id,
    part_name, part_number,
    quantity, unit_cost, markup_pct,
    sell_price, subtotal,
    price_overridden, original_markup_pct,
    stock_status,
    issued_at
  ) VALUES (
    p_tenant_id, p_job_card_id,
    p_part_name, NULLIF(p_part_number, ''),
    p_quantity, p_unit_cost, p_markup_pct,
    p_sell_price, p_subtotal,
    p_price_overridden, p_original_markup_pct,
    CASE WHEN v_has_part THEN 'issued' ELSE 'planned' END,
    CASE WHEN v_has_part THEN NOW() ELSE NULL END
  ) RETURNING * INTO v_line;

  -- 4. If we have inventory, deduct stock + log adjustment + sync warehouse.
  IF v_has_part THEN
    v_new_stock := v_part.stock_qty - p_quantity;

    UPDATE public.parts
       SET stock_qty  = v_new_stock,
           updated_by = p_user_id,
           updated_at = NOW()
     WHERE id = v_part.id
       AND tenant_id = p_tenant_id;

    -- Sync warehouse_stock (if the part is tracked per warehouse)
    UPDATE public.warehouse_stock
       SET quantity = quantity - p_quantity
     WHERE part_id = v_part.id
       AND tenant_id = p_tenant_id;

    -- Fetch vehicle plate for the adjustment reason.
    SELECT v.plate INTO v_plate
      FROM public.job_cards jc
      LEFT JOIN public.vehicles v ON v.id = jc.vehicle_id
     WHERE jc.id = p_job_card_id
       AND jc.tenant_id = p_tenant_id;

    INSERT INTO public.inventory_adjustments (
      tenant_id, part_id,
      quantity_change, quantity_before, quantity_after,
      reason, reference
    ) VALUES (
      p_tenant_id, v_part.id,
      -p_quantity, v_part.stock_qty, v_new_stock,
      'Issued to job: ' || COALESCE(v_plate, ''),
      p_job_card_id::text
    );
  END IF;

  RETURN v_line;
END;
$$;
