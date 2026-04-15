-- ═══════════════════════════════════════════════════════════════
-- Module 16: Vehicle Reception & Check-In
-- Full structured intake: odometer, fuel, damage diagram, photos,
-- accessories/belongings, reported issues, customer signature
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Vehicle reception record (one per job card) ──
CREATE TABLE public.vehicle_receptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  vehicle_id      uuid NOT NULL REFERENCES public.vehicles(id),

  -- Vehicle data at reception
  odometer_km     integer NOT NULL,
  fuel_level      text NOT NULL CHECK (fuel_level IN
                    ('empty', 'quarter', 'half', 'three_quarter', 'full')),
  key_type        text CHECK (key_type IN ('standard', 'remote', 'keyless', 'valet')),
  keys_received   integer NOT NULL DEFAULT 1,

  -- Customer reported issues
  reported_issues text,
  voice_note_url  text,
  symptom_codes   text[] NOT NULL DEFAULT '{}',

  -- Signature
  signature_data  text,               -- base64 signature image or storage URL
  signature_method text CHECK (signature_method IN ('digital', 'whatsapp', 'physical_scan')),
  signed_at       timestamptz,
  signed_by_name  text,

  -- Metadata
  received_by     uuid REFERENCES public.users(id),
  received_at     timestamptz NOT NULL DEFAULT now(),
  completed       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- One reception per job card
  CONSTRAINT uq_reception_per_job UNIQUE (job_card_id)
);

CREATE INDEX idx_receptions_tenant ON public.vehicle_receptions(tenant_id);
CREATE INDEX idx_receptions_job ON public.vehicle_receptions(job_card_id);
CREATE INDEX idx_receptions_vehicle ON public.vehicle_receptions(vehicle_id);

CREATE TRIGGER receptions_updated_at
  BEFORE UPDATE ON public.vehicle_receptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.vehicle_receptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "receptions_select" ON public.vehicle_receptions
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "receptions_insert" ON public.vehicle_receptions
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "receptions_update" ON public.vehicle_receptions
  FOR UPDATE USING (tenant_id = public.get_tenant_id());


-- ── 2. Damage points on body diagram ──
CREATE TABLE public.reception_damage_points (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reception_id    uuid NOT NULL REFERENCES public.vehicle_receptions(id) ON DELETE CASCADE,
  body_zone       text NOT NULL,
  damage_type     text NOT NULL CHECK (damage_type IN
                    ('scratch', 'dent', 'crack', 'chip', 'broken', 'missing', 'rust', 'paint_damage', 'glass_crack', 'torn')),
  severity        text NOT NULL CHECK (severity IN ('minor', 'moderate', 'severe')),
  diagram_view    text NOT NULL DEFAULT 'top' CHECK (diagram_view IN ('top', 'left', 'right', 'front_rear')),
  coordinate_x    numeric(5,2),
  coordinate_y    numeric(5,2),
  note            text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_damage_points_reception ON public.reception_damage_points(reception_id);

ALTER TABLE public.reception_damage_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "damage_points_select" ON public.reception_damage_points
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "damage_points_insert" ON public.reception_damage_points
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "damage_points_update" ON public.reception_damage_points
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "damage_points_delete" ON public.reception_damage_points
  FOR DELETE USING (tenant_id = public.get_tenant_id());


-- ── 3. Photos (walk-around + damage closeups) ──
CREATE TABLE public.reception_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reception_id    uuid NOT NULL REFERENCES public.vehicle_receptions(id) ON DELETE CASCADE,
  damage_point_id uuid REFERENCES public.reception_damage_points(id) ON DELETE SET NULL,
  photo_type      text NOT NULL CHECK (photo_type IN
                    ('front', 'rear', 'left', 'right', 'dashboard', 'interior',
                     'damage_closeup', 'roof', 'engine', 'boot', 'other')),
  storage_url     text NOT NULL,
  thumbnail_url   text,
  captured_at     timestamptz NOT NULL DEFAULT now(),
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reception_photos_reception ON public.reception_photos(reception_id);
CREATE INDEX idx_reception_photos_damage ON public.reception_photos(damage_point_id);

ALTER TABLE public.reception_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reception_photos_select" ON public.reception_photos
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "reception_photos_insert" ON public.reception_photos
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "reception_photos_delete" ON public.reception_photos
  FOR DELETE USING (tenant_id = public.get_tenant_id());


-- ── 4. Accessories & belongings checklist ──
CREATE TABLE public.reception_checklist_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reception_id    uuid NOT NULL REFERENCES public.vehicle_receptions(id) ON DELETE CASCADE,
  category        text NOT NULL CHECK (category IN ('safety', 'accessory', 'belonging')),
  item_code       text,               -- 'jack', 'spare_tire', etc. (null for free-text belongings)
  item_label      text NOT NULL,
  status          text CHECK (status IN ('present', 'absent', 'damaged', 'expired', 'na')),
  detail          text,               -- e.g. "full-size" for spare tire, or free text
  photo_url       text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_items_reception ON public.reception_checklist_items(reception_id);

ALTER TABLE public.reception_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklist_items_select" ON public.reception_checklist_items
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "checklist_items_insert" ON public.reception_checklist_items
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "checklist_items_update" ON public.reception_checklist_items
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "checklist_items_delete" ON public.reception_checklist_items
  FOR DELETE USING (tenant_id = public.get_tenant_id());


-- ── 5. Link job cards to reception ──
ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS reception_id uuid REFERENCES public.vehicle_receptions(id);
