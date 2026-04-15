-- ═══════════════════════════════════════════════════════════════
-- Features: Sub-jobs + In-app Job Messaging
-- ═══════════════════════════════════════════════════════════════

-- ── 1. SUB-JOBS / SPLIT JOBS ──
ALTER TABLE public.job_cards
  ADD COLUMN IF NOT EXISTS parent_job_id uuid REFERENCES public.job_cards(id),
  ADD COLUMN IF NOT EXISTS sub_job_label text;  -- e.g. 'Mechanical', 'Body & Paint', 'Electrical'

CREATE INDEX IF NOT EXISTS idx_job_cards_parent ON public.job_cards(parent_job_id)
  WHERE parent_job_id IS NOT NULL;

COMMENT ON COLUMN public.job_cards.parent_job_id IS 'If set, this job is a sub-job of the parent. Totals roll up.';
COMMENT ON COLUMN public.job_cards.sub_job_label IS 'Label for sub-job type: Mechanical, Body & Paint, Electrical, etc.';

-- ── 2. IN-APP JOB MESSAGING (tech ↔ advisor) ──
CREATE TABLE public.job_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id uuid NOT NULL REFERENCES public.job_cards(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES public.users(id),
  sender_name text NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('technician', 'advisor', 'manager', 'receptionist')),
  message     text NOT NULL,
  photo_url   text,                -- optional photo attachment
  is_read     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_messages_job ON public.job_messages(job_card_id, created_at);
CREATE INDEX idx_job_messages_unread ON public.job_messages(job_card_id)
  WHERE is_read = false;

ALTER TABLE public.job_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_messages_select" ON public.job_messages
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "job_messages_insert" ON public.job_messages
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "job_messages_update" ON public.job_messages
  FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Enable Supabase Realtime on job_messages for live chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_messages;
