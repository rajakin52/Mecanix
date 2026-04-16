-- ═══════════════════════════════════════════════════════════════
-- Close spec gaps: workshop discovery, ratings, bays, health score
-- ═══════════════════════════════════════════════════════════════

-- ── 1. WORKSHOP DISCOVERY & CUSTOMER RATINGS (Module 05) ──

-- Workshop public profile (discoverable by customers)
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_discoverable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7),
  ADD COLUMN IF NOT EXISTS specializations text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS operating_hours jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cover_photo_url text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS avg_rating numeric(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_reviews integer DEFAULT 0;

-- Customer ratings / reviews
CREATE TABLE public.workshop_ratings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES public.customers(id),
  job_card_id     uuid REFERENCES public.job_cards(id),
  rating          integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title           text,
  review          text,
  reply           text,                    -- workshop can reply
  replied_at      timestamptz,
  is_public       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_card_id)                      -- one review per job
);

CREATE INDEX idx_workshop_ratings_tenant ON public.workshop_ratings(tenant_id, created_at DESC);

ALTER TABLE public.workshop_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings_select_public" ON public.workshop_ratings
  FOR SELECT USING (is_public = true OR tenant_id = public.get_tenant_id());
CREATE POLICY "ratings_insert" ON public.workshop_ratings
  FOR INSERT WITH CHECK (true);  -- customers can rate (public insert)
CREATE POLICY "ratings_update" ON public.workshop_ratings
  FOR UPDATE USING (tenant_id = public.get_tenant_id());  -- workshop can reply

-- Auto-update tenant avg_rating on new review
CREATE OR REPLACE FUNCTION public.update_tenant_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.tenants SET
    avg_rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.workshop_ratings WHERE tenant_id = NEW.tenant_id AND is_public = true),
    total_reviews = (SELECT COUNT(*) FROM public.workshop_ratings WHERE tenant_id = NEW.tenant_id AND is_public = true)
  WHERE id = NEW.tenant_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_tenant_rating
  AFTER INSERT OR UPDATE ON public.workshop_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_tenant_rating();


-- ── 2. BAY MANAGEMENT (Module 06) ──

CREATE TABLE public.bays (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text DEFAULT 'general' CHECK (type IN ('general', 'paint', 'body', 'alignment', 'diagnostic', 'wash')),
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bays ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bays_select" ON public.bays FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "bays_insert" ON public.bays FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "bays_update" ON public.bays FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Link jobs to bays
ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS bay_id uuid REFERENCES public.bays(id);

-- Link appointments to bays
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS bay_id uuid REFERENCES public.bays(id);


-- ── 3. AUTO HEALTH SCORE TRIGGER (Module 17) ──
-- Auto-calculate and store health score when inspection items are updated

CREATE OR REPLACE FUNCTION public.auto_calculate_health_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_inspection_id uuid;
  v_total int;
  v_green int;
  v_yellow int;
  v_red int;
  v_score int;
BEGIN
  v_inspection_id := COALESCE(NEW.inspection_id, OLD.inspection_id);

  SELECT
    COUNT(*) FILTER (WHERE status IN ('green','yellow','red')),
    COUNT(*) FILTER (WHERE status = 'green'),
    COUNT(*) FILTER (WHERE status = 'yellow'),
    COUNT(*) FILTER (WHERE status = 'red')
  INTO v_total, v_green, v_yellow, v_red
  FROM public.inspection_items
  WHERE inspection_id = v_inspection_id;

  IF v_total > 0 THEN
    v_score := ROUND((v_green * 100.0 + v_yellow * 50.0) / v_total);
    UPDATE public.vehicle_inspections SET health_score = v_score WHERE id = v_inspection_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_health_score
  AFTER INSERT OR UPDATE OF status ON public.inspection_items
  FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_health_score();


-- ── 4. DVI-TO-ESTIMATE AUTO-CONVERSION ──
-- Flag red DVI items as needing estimate lines

ALTER TABLE public.inspection_items
  ADD COLUMN IF NOT EXISTS estimate_generated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linked_catalogue_id uuid REFERENCES public.repair_catalog(id);


-- ── 5. AGT QR CODE SUPPORT ──

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS agt_qr_code_data text,  -- QR payload string
  ADD COLUMN IF NOT EXISTS agt_short_hash text;     -- first 4 chars of hash

-- Contingency mode tracking
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_contingency boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contingency_reason text,
  ADD COLUMN IF NOT EXISTS contingency_submitted_at timestamptz;


-- ── 6. LGPD DATA EXPORT / DELETION (Module 10) ──

CREATE TABLE public.data_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id     uuid NOT NULL REFERENCES public.customers(id),
  request_type    text NOT NULL CHECK (request_type IN ('export', 'deletion', 'rectification')),
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  export_url      text,                    -- for export requests: download link
  notes           text,
  processed_by    uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "data_requests_select" ON public.data_requests FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "data_requests_insert" ON public.data_requests FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "data_requests_update" ON public.data_requests FOR UPDATE USING (tenant_id = public.get_tenant_id());
