-- ============================================================
-- MECANIX Sprint 4 — Time Tracking, Clock Records, Corrections
-- ============================================================

-- ============================================================
-- TIME ENTRIES (timer per job)
-- ============================================================
CREATE TABLE public.time_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  technician_id   uuid NOT NULL REFERENCES public.technicians(id),
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id),
  started_at      timestamptz NOT NULL DEFAULT NOW(),
  paused_at       timestamptz,
  ended_at        timestamptz,
  total_seconds   integer NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'paused', 'completed')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_time_entries_tenant ON public.time_entries(tenant_id);
CREATE INDEX idx_time_entries_technician ON public.time_entries(tenant_id, technician_id);
CREATE INDEX idx_time_entries_job ON public.time_entries(tenant_id, job_card_id);
CREATE INDEX idx_time_entries_status ON public.time_entries(tenant_id, technician_id, status);

CREATE TRIGGER time_entries_updated_at
  BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_entries_select" ON public.time_entries
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "time_entries_insert" ON public.time_entries
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "time_entries_update" ON public.time_entries
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- CLOCK RECORDS (daily attendance)
-- ============================================================
CREATE TABLE public.clock_records (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  technician_id   uuid NOT NULL REFERENCES public.technicians(id),
  clock_in        timestamptz NOT NULL DEFAULT NOW(),
  clock_out       timestamptz,
  total_minutes   integer,
  date            date NOT NULL DEFAULT CURRENT_DATE,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_clock_record UNIQUE (tenant_id, technician_id, date)
);

CREATE INDEX idx_clock_records_tenant ON public.clock_records(tenant_id);
CREATE INDEX idx_clock_records_technician ON public.clock_records(tenant_id, technician_id, date);

CREATE TRIGGER clock_records_updated_at
  BEFORE UPDATE ON public.clock_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.clock_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clock_records_select" ON public.clock_records
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "clock_records_insert" ON public.clock_records
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "clock_records_update" ON public.clock_records
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- TIME CORRECTIONS (manual entries needing approval)
-- ============================================================
CREATE TABLE public.time_corrections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  technician_id   uuid NOT NULL REFERENCES public.technicians(id),
  job_card_id     uuid NOT NULL REFERENCES public.job_cards(id),
  requested_hours numeric(6,2) NOT NULL,
  reason          text NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by     uuid REFERENCES public.users(id),
  approved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_time_corrections_tenant ON public.time_corrections(tenant_id);

CREATE TRIGGER time_corrections_updated_at
  BEFORE UPDATE ON public.time_corrections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.time_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "time_corrections_select" ON public.time_corrections
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "time_corrections_insert" ON public.time_corrections
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "time_corrections_update" ON public.time_corrections
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- ============================================================
-- PRODUCTIVITY SNAPSHOTS (daily rollup)
-- ============================================================
CREATE TABLE public.productivity_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  technician_id   uuid NOT NULL REFERENCES public.technicians(id),
  date            date NOT NULL,
  hours_logged    numeric(6,2) NOT NULL DEFAULT 0,
  jobs_worked     integer NOT NULL DEFAULT 0,
  jobs_completed  integer NOT NULL DEFAULT 0,
  utilisation_pct numeric(5,2) NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_productivity_snapshot UNIQUE (tenant_id, technician_id, date)
);

CREATE INDEX idx_productivity_snapshots ON public.productivity_snapshots(tenant_id, technician_id, date);

ALTER TABLE public.productivity_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "productivity_snapshots_select" ON public.productivity_snapshots
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "productivity_snapshots_insert" ON public.productivity_snapshots
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
