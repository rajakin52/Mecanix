-- Enable pg_cron and pg_net for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage to postgres role (needed for cron.schedule)
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ── Appointment Reminders: every 15 minutes ──
SELECT cron.schedule(
  'appointment-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.api_url', true) || '/api/v1/cron/appointment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- ── Payment Reminders: daily at 9:00 AM UTC ──
SELECT cron.schedule(
  'payment-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.api_url', true) || '/api/v1/cron/payment-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

-- NOTE: After deploying, set these in Supabase Dashboard → Settings → Database → Configuration:
-- app.settings.api_url = 'https://api-production-9d84.up.railway.app'
-- app.settings.cron_secret = 'mecanix-cron-2026'  (or your chosen secret)
--
-- Or set via SQL:
-- ALTER DATABASE postgres SET app.settings.api_url = 'https://api-production-9d84.up.railway.app';
-- ALTER DATABASE postgres SET app.settings.cron_secret = 'mecanix-cron-2026';
