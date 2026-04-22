-- ═══════════════════════════════════════════════════════════════
-- Edit audit for assessment_findings + assessment_operations.
--
-- Every time an estimator updates or deletes a finding or operation
-- on a damage assessment, we log the before/after state here. The
-- source-flip ('model' -> 'reviewer_override') on assessment_findings
-- tells us *that* a row was edited; this table tells us *what*
-- changed, in a shape that can later feed back into prompt tuning
-- or model fine-tuning.
--
-- Insert-only table. No update, no delete (cascade excepted).
-- Read access is tenant-scoped via RLS.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.assessment_edits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assessment_id  uuid NOT NULL REFERENCES public.damage_assessments(id) ON DELETE CASCADE,

  entity_kind    text NOT NULL CHECK (entity_kind IN ('finding', 'operation')),
  entity_id      uuid NOT NULL,                         -- the finding / operation row id (not FK'd — edit survives row delete)

  action         text NOT NULL CHECK (action IN ('update', 'delete')),

  -- Snapshot of the row before the change. Always present.
  before         jsonb NOT NULL,

  -- After-state. NULL when action='delete'. For updates, this is
  -- the merged row as returned by the update.
  after          jsonb,

  editor_id      uuid REFERENCES public.users(id),
  created_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assessment_edits_assessment
  ON public.assessment_edits(tenant_id, assessment_id, created_at DESC);

CREATE INDEX idx_assessment_edits_entity
  ON public.assessment_edits(tenant_id, entity_kind, entity_id, created_at DESC);

ALTER TABLE public.assessment_edits ENABLE ROW LEVEL SECURITY;

-- Tenant read access.
CREATE POLICY assessment_edits_select ON public.assessment_edits
  FOR SELECT USING (tenant_id = public.get_tenant_id());

-- Writes happen from the API using the service role (which bypasses
-- RLS). No insert policy needed. Deliberately no update/delete policy
-- so rows are effectively append-only from the tenant role's view.
