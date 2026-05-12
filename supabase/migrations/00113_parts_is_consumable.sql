-- ============================================================
-- parts.is_consumable
-- ------------------------------------------------------------
-- Explicit flag for consumables (oil, coolant, brake fluid,
-- wiper blades, filters, cleaning products, paint, sealants…).
-- Drives the "Consumables on hand" report and lets the workshop
-- distinguish "stocked spares" from "things used by the bottle".
-- ============================================================

ALTER TABLE public.parts
  ADD COLUMN is_consumable boolean NOT NULL DEFAULT false;

-- Partial index for fast scans on the consumables report
CREATE INDEX idx_parts_is_consumable
  ON public.parts(tenant_id)
  WHERE is_consumable = true AND is_active = true;
