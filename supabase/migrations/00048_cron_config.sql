-- Reconfigure cron jobs with hardcoded API URL (can't use ALTER DATABASE on Supabase)
-- First unschedule the old jobs that used current_setting
SELECT cron.unschedule('appointment-reminders');
SELECT cron.unschedule('payment-reminders');

-- Reschedule with direct URL
SELECT cron.schedule(
  'appointment-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://api-production-9d84.up.railway.app/api/v1/cron/appointment-reminders',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "mecanix-cron-2026"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'payment-reminders',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://api-production-9d84.up.railway.app/api/v1/cron/payment-reminders',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "mecanix-cron-2026"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
