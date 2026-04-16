-- ═══════════════════════════════════════════════════════════════
-- Features Batch 4: Integrations, Webhooks, Accounting Sync, AI
-- ═══════════════════════════════════════════════════════════════

-- ── 1. WEBHOOK SYSTEM (Zapier/custom integrations) ──

CREATE TABLE public.webhooks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name            text NOT NULL,
  url             text NOT NULL,
  secret          text,                    -- HMAC signing secret
  events          text[] NOT NULL,         -- e.g. {'job.created', 'job.status_changed', 'invoice.created', 'payment.received'}
  is_active       boolean NOT NULL DEFAULT true,
  last_triggered  timestamptz,
  failure_count   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_select" ON public.webhooks FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "webhooks_insert" ON public.webhooks FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "webhooks_update" ON public.webhooks FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "webhooks_delete" ON public.webhooks FOR DELETE USING (tenant_id = public.get_tenant_id());

CREATE TABLE public.webhook_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  webhook_id      uuid NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  event           text NOT NULL,
  payload         jsonb NOT NULL,
  response_status integer,
  response_body   text,
  success         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_webhook ON public.webhook_logs(webhook_id, created_at DESC);

ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhook_logs_select" ON public.webhook_logs FOR SELECT USING (tenant_id = public.get_tenant_id());


-- ── 2. ACCOUNTING SYNC (QuickBooks, Zoho, Odoo) ──

CREATE TABLE public.accounting_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider        text NOT NULL CHECK (provider IN ('quickbooks', 'zoho', 'odoo', 'xero', 'sage')),
  provider_company_id text,               -- external company/org ID
  access_token    text,                    -- encrypted
  refresh_token   text,                    -- encrypted
  token_expires_at timestamptz,
  base_url        text,                    -- for Odoo: the instance URL
  database_name   text,                    -- for Odoo: the database name
  api_key         text,                    -- for Odoo: API key alternative
  config          jsonb DEFAULT '{}',      -- provider-specific settings
  is_active       boolean NOT NULL DEFAULT true,
  last_sync_at    timestamptz,
  sync_errors     text[],
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, provider)
);

ALTER TABLE public.accounting_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounting_conn_select" ON public.accounting_connections FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "accounting_conn_insert" ON public.accounting_connections FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "accounting_conn_update" ON public.accounting_connections FOR UPDATE USING (tenant_id = public.get_tenant_id());

-- Sync log
CREATE TABLE public.accounting_sync_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connection_id   uuid NOT NULL REFERENCES public.accounting_connections(id) ON DELETE CASCADE,
  entity_type     text NOT NULL,           -- 'invoice', 'payment', 'customer', 'expense'
  entity_id       uuid NOT NULL,
  external_id     text,                    -- ID in the external system
  direction       text NOT NULL CHECK (direction IN ('push', 'pull')),
  status          text NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_log_entity ON public.accounting_sync_log(entity_type, entity_id);

ALTER TABLE public.accounting_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_log_select" ON public.accounting_sync_log FOR SELECT USING (tenant_id = public.get_tenant_id());


-- ── 3. GOOGLE CALENDAR SYNC ──

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS google_event_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_synced boolean NOT NULL DEFAULT false;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS google_calendar_id text,
  ADD COLUMN IF NOT EXISTS google_calendar_token jsonb;


-- ── 4. PHOTO MARKUP / ANNOTATION ──

CREATE TABLE public.photo_annotations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  photo_url       text NOT NULL,           -- original photo URL
  annotated_url   text,                    -- annotated version URL
  annotations     jsonb NOT NULL DEFAULT '[]',  -- array of {type, x, y, width, height, color, text}
  entity_type     text NOT NULL,           -- 'inspection', 'reception', 'job'
  entity_id       uuid NOT NULL,
  created_by      uuid REFERENCES public.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.photo_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "annotations_select" ON public.photo_annotations FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "annotations_insert" ON public.photo_annotations FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());


-- ── 5. AI FEATURES (foundation tables) ──

CREATE TABLE public.ai_suggestions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  job_card_id     uuid REFERENCES public.job_cards(id),
  suggestion_type text NOT NULL CHECK (suggestion_type IN
    ('diagnosis', 'parts', 'labour', 'upsell', 'writing', 'technician_assignment')),
  input_data      jsonb NOT NULL,
  suggestion      jsonb NOT NULL,
  model           text,                    -- AI model used
  confidence      numeric(3,2),            -- 0.00 - 1.00
  accepted        boolean,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_suggestions_select" ON public.ai_suggestions FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "ai_suggestions_insert" ON public.ai_suggestions FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
