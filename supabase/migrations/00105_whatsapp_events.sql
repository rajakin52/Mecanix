-- ═══════════════════════════════════════════════════════════════
-- whatsapp_events: persistent audit log of every WhatsApp send
-- attempt. One row per API call (including skipped calls when env
-- vars missing), so diagnosing a delivery issue never requires
-- trawling ephemeral Railway logs again.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.whatsapp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,

  -- Addressing
  phone_raw text,                 -- what the caller passed in
  phone_e164 text,                -- normalised, E.164 without '+'
  meta_phone_number_id text,      -- which WhatsApp business number we sent FROM

  -- What we tried to send
  template_name text,
  language_code text,
  request_body jsonb,             -- full payload we POST to Meta

  -- Outcome
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  meta_message_id text,           -- Meta's wamid on success
  meta_response_code int,         -- HTTP status from Meta
  meta_response_body jsonb,       -- raw Meta response
  error text,                     -- human-readable error reason

  -- Context — what prompted the send
  context_type text,              -- 'photo_capture' | 'signature' | 'estimate' | ...
  context_id uuid,                -- session / estimate / etc. id

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_events_tenant ON public.whatsapp_events(tenant_id);
CREATE INDEX idx_whatsapp_events_phone ON public.whatsapp_events(phone_e164);
CREATE INDEX idx_whatsapp_events_created ON public.whatsapp_events(created_at DESC);
CREATE INDEX idx_whatsapp_events_status ON public.whatsapp_events(status);
CREATE INDEX idx_whatsapp_events_context ON public.whatsapp_events(context_type, context_id);

COMMENT ON TABLE public.whatsapp_events IS
  'Audit log of every Meta WhatsApp Cloud API attempt. status=skipped means env vars not configured; status=failed includes the Meta response for diagnosis.';

NOTIFY pgrst, 'reload schema';
