-- Device push notification tokens
CREATE TABLE public.device_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Token details
  push_token      text NOT NULL,
  platform        text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  app_type        text NOT NULL CHECK (app_type IN ('customer', 'workshop', 'technician')),

  -- Status
  is_active       boolean NOT NULL DEFAULT true,
  last_used_at    timestamptz,

  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW(),

  -- Unique per user+token combination
  UNIQUE (user_id, push_token)
);

CREATE INDEX idx_device_tokens_user ON public.device_tokens(user_id) WHERE is_active = true;
CREATE INDEX idx_device_tokens_tenant ON public.device_tokens(tenant_id) WHERE is_active = true;

CREATE TRIGGER device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_tokens_select" ON public.device_tokens
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "device_tokens_insert" ON public.device_tokens
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
CREATE POLICY "device_tokens_update" ON public.device_tokens
  FOR UPDATE USING (tenant_id = public.get_tenant_id());
CREATE POLICY "device_tokens_delete" ON public.device_tokens
  FOR DELETE USING (tenant_id = public.get_tenant_id());

-- Notification history for audit
CREATE TABLE public.notification_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Target
  user_id         uuid REFERENCES public.users(id),
  channel         text NOT NULL CHECK (channel IN ('push', 'whatsapp', 'sms', 'email')),

  -- Content
  title           text,
  body            text NOT NULL,
  data            jsonb DEFAULT '{}',

  -- Context
  entity_type     text,     -- job, appointment, invoice, etc.
  entity_id       uuid,

  -- Status
  status          text NOT NULL DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
  error_message   text,
  sent_at         timestamptz DEFAULT NOW(),

  created_at      timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notification_history_user ON public.notification_history(user_id);
CREATE INDEX idx_notification_history_entity ON public.notification_history(entity_type, entity_id);

ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_history_select" ON public.notification_history
  FOR SELECT USING (tenant_id = public.get_tenant_id());
CREATE POLICY "notification_history_insert" ON public.notification_history
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
