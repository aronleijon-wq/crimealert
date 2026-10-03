-- The Sunday evening summary of the week's events in each user's kommuner.

-- On for everyone who has notifications, and can be turned off on the Notiser page.
-- Users without a settings row get it too, as with the other settings.
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS weekly_summary boolean NOT NULL DEFAULT true;

-- One summary per user and week, however often the sender runs
CREATE TABLE IF NOT EXISTS public.weekly_summary_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week)
);
ALTER TABLE public.weekly_summary_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.weekly_summary_log TO service_role;

-- Every hour on Sundays; send-push-notifications only sends between 18 and 21 Swedish time
-- (summer and winter), each user once a week. The bearer token is the public anon key.
SELECT cron.unschedule('crimealert-weekly-summary')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crimealert-weekly-summary');
SELECT cron.schedule(
  'crimealert-weekly-summary',
  '5 * * * 0',
  $$
  SELECT net.http_post(
    url := 'https://pqoiwiiydtikouzjrllx.supabase.co/functions/v1/send-push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxb2l3aWl5ZHRpa291empybGx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQzMTEsImV4cCI6MjA4NzAxMDMxMX0._hZ5CWcDEpWPgk6hSUBHbsbA1ymu7LYfXkFUxgACohk'
    ),
    body := '{"mode":"weekly"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
