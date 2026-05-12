-- ============================================================
-- Parts vehicle compatibility
-- ------------------------------------------------------------
-- Adds is_universal flag on parts (true = fits any vehicle —
-- batteries, tyres, lubricants, paint, etc.) and a join table
-- of explicit (make, model, year-range) compatibility rows for
-- non-universal parts. PO line creation can then filter the
-- parts picker by the vehicle the order is intended for.
-- ============================================================

ALTER TABLE public.parts
  ADD COLUMN is_universal boolean NOT NULL DEFAULT false;

-- Backfill: every existing part keeps showing up in POs regardless
-- of filter until someone explicitly scopes it.
UPDATE public.parts SET is_universal = true;

CREATE INDEX idx_parts_is_universal ON public.parts(tenant_id) WHERE is_universal = true;

-- ============================================================
-- part_vehicle_compat
-- ------------------------------------------------------------
-- model NULL = "fits all models of this make"
-- year_from / year_to NULL = open-ended on that side
-- ============================================================
CREATE TABLE public.part_vehicle_compat (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  part_id     uuid NOT NULL REFERENCES public.parts(id) ON DELETE CASCADE,
  make        text NOT NULL,
  model       text,
  year_from   integer,
  year_to     integer,
  created_at  timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_pvc_year_order
    CHECK (year_from IS NULL OR year_to IS NULL OR year_from <= year_to),
  CONSTRAINT chk_pvc_year_range
    CHECK (
      (year_from IS NULL OR (year_from BETWEEN 1900 AND 2100)) AND
      (year_to   IS NULL OR (year_to   BETWEEN 1900 AND 2100))
    ),
  CONSTRAINT chk_pvc_make_nonblank
    CHECK (length(btrim(make)) > 0)
);

CREATE INDEX idx_pvc_part ON public.part_vehicle_compat(part_id);
CREATE INDEX idx_pvc_lookup ON public.part_vehicle_compat(tenant_id, make, model);

ALTER TABLE public.part_vehicle_compat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pvc_select" ON public.part_vehicle_compat
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pvc_insert" ON public.part_vehicle_compat
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "pvc_update" ON public.part_vehicle_compat
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "pvc_delete" ON public.part_vehicle_compat
  FOR DELETE USING (tenant_id = public.get_tenant_id());
