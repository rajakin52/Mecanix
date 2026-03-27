-- ============================================================
-- MECANIX — Batch 1 Features
-- Preferred channel, canned notes, QR data
-- ============================================================

-- Customer preferred communication channel
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT 'whatsapp'
    CHECK (preferred_channel IN ('whatsapp', 'email', 'app', 'sms'));

-- Canned diagnosis notes for technicians
CREATE TABLE public.canned_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category        text NOT NULL,
  title           text NOT NULL,
  content         text NOT NULL,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_canned_notes_tenant ON public.canned_notes(tenant_id);

ALTER TABLE public.canned_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "canned_notes_tenant_isolation" ON public.canned_notes
  USING (tenant_id = public.get_tenant_id());
