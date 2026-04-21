-- ═══════════════════════════════════════════════════════════════
-- pg_cron schedule for review-prompt processing.
--
-- Promoters (NPS >= 9) get a prompt scheduled 24 h after their
-- survey arrives. Without this cron call, scheduled rows just sit
-- in satisfaction_surveys forever. Runs every 15 minutes on the
-- same pattern as appointment-reminders.
--
-- Prereq: migration 00047 enabled pg_cron + pg_net and the
-- app.settings.api_url / app.settings.cron_secret database settings
-- have been configured there.
-- ═══════════════════════════════════════════════════════════════

SELECT cron.schedule(
  'review-prompts',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.api_url', true) || '/api/v1/cron/review-prompts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', current_setting('app.settings.cron_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
