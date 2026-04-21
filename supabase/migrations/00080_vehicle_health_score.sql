-- ═══════════════════════════════════════════════════════════════
-- Module 19 / Phase 4 item 3 — Vehicle-level health score.
--
-- vehicle_inspections already carries a per-inspection health_score
-- (0-100, derived from inspection_items colour). That's a snapshot
-- of the last DVI. A *vehicle-level* rolling score is more useful
-- to owners: combines the latest DVI, recent comebacks, open
-- deferred items, days since last service, and active warranty
-- coverage into one number they can act on.
--
-- Computed lazily on read with a 1-hour TTL (handled in service).
-- The JSONB breakdown is stored so the UI can explain *why* a
-- score dropped without re-querying everything.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS health_score             integer CHECK (health_score IS NULL OR (health_score BETWEEN 0 AND 100)),
  ADD COLUMN IF NOT EXISTS health_score_updated_at  timestamptz,
  ADD COLUMN IF NOT EXISTS health_score_components  jsonb;

CREATE INDEX IF NOT EXISTS idx_vehicles_health_score
  ON public.vehicles(tenant_id, health_score)
  WHERE health_score IS NOT NULL;
