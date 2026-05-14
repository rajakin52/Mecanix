-- 00117_soa_email_automation.sql
-- Monthly Statement of Account email automation.
--
-- Per-tenant settings live in tenants.settings JSONB under the `soa` key:
--   {
--     "enabled": true,
--     "send_day": 1,                 -- day-of-month 1..28
--     "send_hour_utc": 7,            -- 0..23
--     "from_name": "Workshop Name",  -- override; falls back to tenant name
--     "from_email": null,            -- override; null => default verified domain
--     "reply_to": null,
--     "subject_template": "Statement of Account — {{period}}",
--     "intro_template": "Dear {{customer_name}}, please find your statement attached.",
--     "include_paid_invoices": false,
--     "whatsapp_fallback": true
--   }
--
-- soa_send_log captures every attempt (cron run or manual) so we can audit,
-- retry, and surface "last run" status in the UI.

CREATE TABLE IF NOT EXISTS public.soa_send_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id   uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  -- batch id groups everything sent in a single cron pass / manual run
  batch_id      uuid NOT NULL,
  triggered_by  text NOT NULL CHECK (triggered_by IN ('cron', 'manual', 'test')),
  triggered_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  channel       text NOT NULL CHECK (channel IN ('email', 'whatsapp', 'skipped')),
  recipient     text,                       -- email address or phone number actually used
  status        text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped_no_balance', 'skipped_no_contact', 'skipped_no_provider')),
  error_message text,
  outstanding   numeric(14, 2),             -- snapshot of total outstanding at send time
  open_invoices integer,
  provider_message_id text,                 -- Resend / WhatsApp id for traceability
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS soa_send_log_tenant_created_idx
  ON public.soa_send_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS soa_send_log_batch_idx
  ON public.soa_send_log (batch_id);
CREATE INDEX IF NOT EXISTS soa_send_log_customer_idx
  ON public.soa_send_log (customer_id);

ALTER TABLE public.soa_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY soa_send_log_tenant_isolation ON public.soa_send_log
  USING (tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT u.tenant_id FROM public.users u WHERE u.auth_id = auth.uid()));

COMMENT ON TABLE public.soa_send_log IS
  'Audit log for SOA email/WhatsApp dispatches. One row per customer per attempt.';
