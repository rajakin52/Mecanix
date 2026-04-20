-- ═══════════════════════════════════════════════════════════════
-- Module 18 / Phase 2 — Before/after photos per service line.
--
-- Walk-around photos (photo_capture_items) prove condition at
-- drop-off. That's not the same as proving the work was done — for
-- that we need per-line before/after pairs attached to a specific
-- parts_line or labour_line. Used by the tech to defend labour on
-- high-ticket jobs and by the customer to SEE what was changed.
--
-- The pair "kind + line_id + snapshot" is the useful shape; we keep
-- both parts_line_id and labour_line_id as nullable FKs and CHECK
-- exactly one is set, so the parent FK cascade works naturally when
-- a line is deleted.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.line_photos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  line_kind       text NOT NULL CHECK (line_kind IN ('parts', 'labour')),
  parts_line_id   uuid REFERENCES public.parts_lines(id) ON DELETE CASCADE,
  labour_line_id  uuid REFERENCES public.labour_lines(id) ON DELETE CASCADE,
  snapshot        text NOT NULL CHECK (snapshot IN ('before', 'after')),
  storage_url     text NOT NULL,
  thumbnail_url   text,
  caption         text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  created_by      uuid REFERENCES public.users(id),

  -- Exactly one of the two line FKs must be set, matching line_kind.
  CONSTRAINT line_photos_one_line CHECK (
    (line_kind = 'parts'  AND parts_line_id IS NOT NULL AND labour_line_id IS NULL)
    OR
    (line_kind = 'labour' AND labour_line_id IS NOT NULL AND parts_line_id IS NULL)
  )
);

CREATE INDEX idx_line_photos_tenant ON public.line_photos(tenant_id);
CREATE INDEX idx_line_photos_job    ON public.line_photos(tenant_id, job_card_id);
CREATE INDEX idx_line_photos_parts  ON public.line_photos(parts_line_id)  WHERE parts_line_id  IS NOT NULL;
CREATE INDEX idx_line_photos_labour ON public.line_photos(labour_line_id) WHERE labour_line_id IS NOT NULL;

ALTER TABLE public.line_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS line_photos_select ON public.line_photos;
CREATE POLICY line_photos_select ON public.line_photos
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS line_photos_insert ON public.line_photos;
CREATE POLICY line_photos_insert ON public.line_photos
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS line_photos_update ON public.line_photos;
CREATE POLICY line_photos_update ON public.line_photos
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS line_photos_delete ON public.line_photos;
CREATE POLICY line_photos_delete ON public.line_photos
  FOR DELETE USING (tenant_id = public.get_tenant_id());
