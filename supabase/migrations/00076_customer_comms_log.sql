-- ═══════════════════════════════════════════════════════════════
-- Module 18 / Phase 3 — Customer communications log.
--
-- Every automated customer touch (WhatsApp / SMS / push / email)
-- has been firing through notifications.service without leaving
-- any audit trail in the back-office. That's a problem when:
--   - a customer calls and says "you never sent me that quote"
--   - a manager wants to know why a dunning step was skipped
--   - an insurance case needs a comms record
--
-- This table is append-only by design — no updates, just inserts.
-- We keep the template key so we can render the full message in
-- the back-office regardless of which tenant language it was
-- delivered in.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.customer_comms (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  job_card_id     uuid REFERENCES public.job_cards(id) ON DELETE SET NULL,
  invoice_id      uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  channel         text NOT NULL CHECK (channel IN ('whatsapp', 'sms', 'push', 'email')),
  template_key    text NOT NULL,
  direction       text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  recipient       text,
  body            text,
  sent_at         timestamptz NOT NULL DEFAULT NOW(),
  delivery_status text NOT NULL DEFAULT 'sent' CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  delivery_error  text,
  metadata        jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_customer_comms_tenant   ON public.customer_comms(tenant_id);
CREATE INDEX idx_customer_comms_customer ON public.customer_comms(tenant_id, customer_id, sent_at DESC);
CREATE INDEX idx_customer_comms_job      ON public.customer_comms(job_card_id) WHERE job_card_id IS NOT NULL;
CREATE INDEX idx_customer_comms_invoice  ON public.customer_comms(invoice_id)  WHERE invoice_id  IS NOT NULL;

ALTER TABLE public.customer_comms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_comms_select ON public.customer_comms;
CREATE POLICY customer_comms_select ON public.customer_comms
  FOR SELECT USING (tenant_id = public.get_tenant_id());

DROP POLICY IF EXISTS customer_comms_insert ON public.customer_comms;
CREATE POLICY customer_comms_insert ON public.customer_comms
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id());
