-- ═══════════════════════════════════════════════════════════════
-- Module 20 foundation (Phase 3 item 3 finisher) — claim packets.
--
-- Today every insurer submission is typed by hand into the insurer
-- portal. This table tracks the generated packet bundle (PDF +
-- photos in Supabase Storage) per claim, which channel it was
-- sent through, and the state of the insurer response.
--
-- Tables:
--   - claim_packets — one row per generated packet. Re-generating
--     a packet inserts a new row so the history of what was sent
--     when is preserved.
--   - insurance_companies gets submission_email + submission_notes
--     so the shop can configure where to send the packet.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.insurance_companies
  ADD COLUMN IF NOT EXISTS submission_email text,
  ADD COLUMN IF NOT EXISTS submission_notes text;

CREATE TABLE public.claim_packets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  claim_id        uuid NOT NULL REFERENCES public.insurance_claims(id) ON DELETE CASCADE,

  storage_path    text NOT NULL,
  public_url      text,
  file_size       integer NOT NULL DEFAULT 0,

  submitted_at    timestamptz,
  submitted_to    text,                      -- email captured at submission time
  submitted_via   text CHECK (submitted_via IN ('email', 'api', 'manual_portal')),
  response_at     timestamptz,
  response_status text CHECK (response_status IN ('acknowledged', 'approved', 'rejected', 'supplement_requested')),
  response_notes  text,

  generated_at    timestamptz NOT NULL DEFAULT NOW(),
  generated_by    uuid REFERENCES public.users(id)
);

CREATE INDEX idx_claim_packets_claim   ON public.claim_packets(tenant_id, claim_id, generated_at DESC);
CREATE INDEX idx_claim_packets_pending ON public.claim_packets(tenant_id)
  WHERE submitted_at IS NULL;

ALTER TABLE public.claim_packets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS claim_packets_select ON public.claim_packets;
CREATE POLICY claim_packets_select ON public.claim_packets
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS claim_packets_insert ON public.claim_packets;
CREATE POLICY claim_packets_insert ON public.claim_packets
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS claim_packets_update ON public.claim_packets;
CREATE POLICY claim_packets_update ON public.claim_packets
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Storage bucket for packet PDFs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'claim-packets',
  'claim-packets',
  true,
  26214400,                                   -- 25 MB cap
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;
