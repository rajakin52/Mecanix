-- ═══════════════════════════════════════════════════════════════
-- Module 18 / Phase 3 — Tire & seasonal storage.
--
-- Common revenue line across PT / AO workshops: customers leave
-- their winter or summer tires at the shop between seasons. A
-- monthly storage fee accrues per slot; on pickup the shop also
-- fits them. Without a dedicated table this happens on sticky
-- notes and fridge magnets.
--
-- A single storage unit represents ONE set of four tires (or a
-- custom count) in a specific rack location. Status transitions:
--   stored → fitted (back on the car, job closed)
--   stored → returned (customer took them home without fitment)
--   stored → written_off (damaged, abandoned, etc.)
-- Each status change is an append on tire_storage_events so the
-- audit trail is explicit.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.tire_storage (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id        uuid NOT NULL REFERENCES public.customers(id),
  vehicle_id         uuid REFERENCES public.vehicles(id),

  storage_code       text,                              -- e.g. "R3-B-04" (rack-row-slot)
  tire_count         integer NOT NULL DEFAULT 4,
  tire_brand         text,
  tire_model         text,
  tire_size          text,                              -- "205/55 R16"
  season             text NOT NULL CHECK (season IN ('summer', 'winter', 'all_season')),
  tread_depth_mm     numeric(4,1),                      -- avg at intake
  wheel_included     boolean NOT NULL DEFAULT false,
  photo_urls         text[] NOT NULL DEFAULT '{}',
  notes              text,

  -- Commercial terms
  monthly_fee        numeric(12,2) NOT NULL DEFAULT 0,
  currency           text,                              -- falls back to tenant currency

  status             text NOT NULL DEFAULT 'stored'
    CHECK (status IN ('stored', 'fitted', 'returned', 'written_off')),
  stored_at          timestamptz NOT NULL DEFAULT NOW(),
  retrieved_at       timestamptz,                       -- set when status leaves 'stored'

  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW(),
  created_by         uuid REFERENCES public.users(id),
  updated_by         uuid REFERENCES public.users(id)
);

CREATE INDEX idx_tire_storage_tenant   ON public.tire_storage(tenant_id);
CREATE INDEX idx_tire_storage_customer ON public.tire_storage(tenant_id, customer_id);
CREATE INDEX idx_tire_storage_vehicle  ON public.tire_storage(tenant_id, vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX idx_tire_storage_active   ON public.tire_storage(tenant_id, stored_at DESC) WHERE status = 'stored';
CREATE UNIQUE INDEX uq_tire_storage_code ON public.tire_storage(tenant_id, storage_code)
  WHERE storage_code IS NOT NULL AND status = 'stored';

CREATE TRIGGER tire_storage_updated_at
  BEFORE UPDATE ON public.tire_storage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.tire_storage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tire_storage_select ON public.tire_storage;
CREATE POLICY tire_storage_select ON public.tire_storage
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS tire_storage_insert ON public.tire_storage;
CREATE POLICY tire_storage_insert ON public.tire_storage
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS tire_storage_update ON public.tire_storage;
CREATE POLICY tire_storage_update ON public.tire_storage
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS tire_storage_delete ON public.tire_storage;
CREATE POLICY tire_storage_delete ON public.tire_storage
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- Append-only event log
CREATE TABLE public.tire_storage_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  storage_id   uuid NOT NULL REFERENCES public.tire_storage(id) ON DELETE CASCADE,
  event_type   text NOT NULL CHECK (event_type IN ('stored', 'fitted', 'returned', 'written_off', 'inspected', 'note')),
  notes        text,
  job_card_id  uuid REFERENCES public.job_cards(id),
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  created_by   uuid REFERENCES public.users(id)
);

CREATE INDEX idx_tire_storage_events_storage ON public.tire_storage_events(storage_id, created_at DESC);

ALTER TABLE public.tire_storage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tire_storage_events_select ON public.tire_storage_events;
CREATE POLICY tire_storage_events_select ON public.tire_storage_events
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS tire_storage_events_insert ON public.tire_storage_events;
CREATE POLICY tire_storage_events_insert ON public.tire_storage_events
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
