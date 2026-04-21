-- ═══════════════════════════════════════════════════════════════
-- Module 21 / 22 — AIDA scaffold (Sprint 7 integration point).
--
-- This is the MECANIX-side anchor for the AI Damage Assessment
-- module. The ML pipeline (panel segmentation, damage classifier,
-- operation decisioning) lives outside this repo and will eventually
-- POST findings/operations back into these tables. For now the
-- tables support fully manual assessments so the workshop can use
-- AIDA as a structured walk-around tool while the model is trained.
--
-- Shape:
--   damage_assessments     — one row per inspection session.
--   assessment_photos      — captured images, optionally annotated
--                             with view angle + panel hint.
--   assessment_findings    — detected damage per panel (manual
--                             today, model output Sprint 8+).
--   assessment_operations  — proposed repair operations
--                             (replace / repair / paint) with
--                             estimated hours + parts cost.
--
-- An assessment may attach to:
--   - a vehicle (always)
--   - optionally a job_card (when it drives a repair)
--   - optionally an insurance_claim (when it drives a packet)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.damage_assessments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES public.branches(id) ON DELETE SET NULL,

  vehicle_id          uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  job_card_id         uuid REFERENCES public.job_cards(id) ON DELETE SET NULL,
  claim_id            uuid REFERENCES public.insurance_claims(id) ON DELETE SET NULL,

  status              text NOT NULL DEFAULT 'capturing'
                       CHECK (status IN ('capturing', 'analysing', 'ready', 'approved', 'rejected', 'cancelled')),
  source              text NOT NULL DEFAULT 'manual'
                       CHECK (source IN ('manual', 'aida_v0', 'aida_v1')),

  capture_started_at  timestamptz NOT NULL DEFAULT NOW(),
  capture_ended_at    timestamptz,
  analysed_at         timestamptz,
  analysed_by_model   text,                            -- model version tag
  reviewed_at         timestamptz,
  reviewed_by         uuid REFERENCES public.users(id),
  review_notes        text,

  -- Aggregated decision rollup. Populated by the worker once findings
  -- + operations are in. Kept here so list views don't need joins.
  total_hours         numeric(8,2) NOT NULL DEFAULT 0,
  total_parts_cost    numeric(14,2) NOT NULL DEFAULT 0,
  total_paint_cost    numeric(14,2) NOT NULL DEFAULT 0,
  total_estimate      numeric(14,2) NOT NULL DEFAULT 0,
  confidence_avg      numeric(4,3),                    -- 0..1

  created_at          timestamptz NOT NULL DEFAULT NOW(),
  created_by          uuid REFERENCES public.users(id),
  updated_at          timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_damage_assessments_tenant   ON public.damage_assessments(tenant_id, status, created_at DESC);
CREATE INDEX idx_damage_assessments_vehicle  ON public.damage_assessments(tenant_id, vehicle_id, created_at DESC);
CREATE INDEX idx_damage_assessments_job      ON public.damage_assessments(tenant_id, job_card_id) WHERE job_card_id IS NOT NULL;
CREATE INDEX idx_damage_assessments_claim    ON public.damage_assessments(tenant_id, claim_id)    WHERE claim_id    IS NOT NULL;
CREATE INDEX idx_damage_assessments_branch   ON public.damage_assessments(tenant_id, branch_id)   WHERE branch_id   IS NOT NULL;

-- ─── photos ────────────────────────────────────────────────────
CREATE TABLE public.assessment_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id   uuid NOT NULL REFERENCES public.damage_assessments(id) ON DELETE CASCADE,

  storage_path    text NOT NULL,
  public_url      text,
  thumbnail_url   text,

  view_angle      text CHECK (view_angle IN (
    'front', 'front_left', 'front_right',
    'left', 'right',
    'rear', 'rear_left', 'rear_right',
    'roof', 'interior', 'detail', 'vin_plate', 'odometer', 'other'
  )),
  panel_hint      text,                                -- e.g. 'front_bumper'
  width_px        integer,
  height_px       integer,
  exif_lat        numeric(9,6),
  exif_lng        numeric(9,6),
  exif_taken_at   timestamptz,

  uploaded_at     timestamptz NOT NULL DEFAULT NOW(),
  uploaded_by     uuid REFERENCES public.users(id)
);

CREATE INDEX idx_assessment_photos_assessment ON public.assessment_photos(tenant_id, assessment_id, uploaded_at);

-- ─── findings (per panel) ──────────────────────────────────────
CREATE TABLE public.assessment_findings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id     uuid NOT NULL REFERENCES public.damage_assessments(id) ON DELETE CASCADE,

  panel             text NOT NULL,                    -- e.g. 'front_bumper', 'left_front_door'
  damage_type       text NOT NULL CHECK (damage_type IN (
    'dent', 'scratch', 'tear', 'crack', 'misalignment', 'paint_blemish', 'missing', 'other'
  )),
  severity          smallint NOT NULL CHECK (severity BETWEEN 1 AND 5),
  area_pct          numeric(5,2),                     -- % of panel affected
  confidence        numeric(4,3),                     -- 0..1; null when manual
  source            text NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('manual', 'model', 'reviewer_override')),
  model_version     text,                              -- when source = 'model'
  notes             text,

  created_at        timestamptz NOT NULL DEFAULT NOW(),
  created_by        uuid REFERENCES public.users(id)
);

CREATE INDEX idx_assessment_findings_assessment ON public.assessment_findings(tenant_id, assessment_id);

-- ─── proposed operations ───────────────────────────────────────
CREATE TABLE public.assessment_operations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id     uuid NOT NULL REFERENCES public.damage_assessments(id) ON DELETE CASCADE,
  finding_id        uuid REFERENCES public.assessment_findings(id) ON DELETE SET NULL,

  panel             text NOT NULL,
  operation         text NOT NULL CHECK (operation IN ('replace', 'repair', 'paint', 'blend', 'r_and_i')),
  labour_hours      numeric(6,2) NOT NULL DEFAULT 0,
  parts_cost        numeric(14,2) NOT NULL DEFAULT 0,
  paint_cost        numeric(14,2) NOT NULL DEFAULT 0,
  oem_part_number   text,
  source            text NOT NULL DEFAULT 'manual'
                     CHECK (source IN ('manual', 'model', 'reviewer_override')),
  notes             text,

  created_at        timestamptz NOT NULL DEFAULT NOW(),
  created_by        uuid REFERENCES public.users(id)
);

CREATE INDEX idx_assessment_operations_assessment ON public.assessment_operations(tenant_id, assessment_id);

-- ─── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.damage_assessments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_photos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_findings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_operations  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS damage_assessments_rw ON public.damage_assessments;
CREATE POLICY damage_assessments_rw ON public.damage_assessments
  FOR ALL USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS assessment_photos_rw ON public.assessment_photos;
CREATE POLICY assessment_photos_rw ON public.assessment_photos
  FOR ALL USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS assessment_findings_rw ON public.assessment_findings;
CREATE POLICY assessment_findings_rw ON public.assessment_findings
  FOR ALL USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS assessment_operations_rw ON public.assessment_operations;
CREATE POLICY assessment_operations_rw ON public.assessment_operations
  FOR ALL USING (tenant_id = public.get_tenant_id())
  WITH CHECK (tenant_id = public.get_tenant_id());

-- ─── storage bucket for capture photos ─────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'aida-captures',
  'aida-captures',
  true,
  20971520,                                            -- 20 MB per image
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
