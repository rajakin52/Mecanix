-- 00122_soa_delivery_tracking.sql
-- Track delivery outcomes coming back from Resend webhooks (and, later,
-- WhatsApp delivery callbacks). Kept separate from soa_send_log.status
-- so we can distinguish "we accepted the send" from "the recipient's
-- server actually delivered the email."
--
-- delivery_status values follow Resend's event types:
--   - delivered   email.delivered
--   - bounced     email.bounced (hard bounce — invalid address)
--   - complained  email.complained (recipient marked spam)
--   - opened      email.opened (only set when no later terminal event arrives)
--   - clicked     email.clicked
--
-- delivery_event_at = the timestamp on the most recent event.
-- delivery_error    = bounce reason / spam classification reason.

ALTER TABLE public.soa_send_log
  ADD COLUMN IF NOT EXISTS delivery_status   text
    CHECK (delivery_status IS NULL OR delivery_status IN
      ('delivered', 'bounced', 'complained', 'opened', 'clicked')),
  ADD COLUMN IF NOT EXISTS delivery_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_error    text;

-- Fast lookup by provider_message_id (the webhook handler's only key).
CREATE INDEX IF NOT EXISTS soa_send_log_provider_msg_idx
  ON public.soa_send_log (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

COMMENT ON COLUMN public.soa_send_log.delivery_status IS
  'Resend webhook outcome (delivered/bounced/complained/opened/clicked). Null until a webhook event arrives.';
COMMENT ON COLUMN public.soa_send_log.delivery_event_at IS
  'Timestamp from the most recent webhook event for this row.';
COMMENT ON COLUMN public.soa_send_log.delivery_error IS
  'Bounce reason or spam classification when delivery_status is bounced/complained.';
