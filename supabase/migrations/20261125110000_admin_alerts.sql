-- A mail to the owner when someone makes an account or starts Pro (functions/admin-alerts).
-- Each account and subscription is told about once; only the service role reads this.
CREATE TABLE IF NOT EXISTS public.admin_alert_log (
  key text PRIMARY KEY,
  told_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_alert_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_alert_log FROM anon, authenticated;
GRANT ALL ON public.admin_alert_log TO service_role;

-- Every 15 minutes. The bearer token is the public anon key, as for the other schedules.
SELECT cron.unschedule('crimealert-admin-alerts')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crimealert-admin-alerts');
SELECT cron.schedule(
  'crimealert-admin-alerts',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pqoiwiiydtikouzjrllx.supabase.co/functions/v1/admin-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxb2l3aWl5ZHRpa291empybGx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQzMTEsImV4cCI6MjA4NzAxMDMxMX0._hZ5CWcDEpWPgk6hSUBHbsbA1ymu7LYfXkFUxgACohk'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
