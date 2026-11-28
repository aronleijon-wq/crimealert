-- E-mails to new accounts (lifecycle-emails, _shared/lifecycleEmails): a welcome, day 3, day 7
-- and "what you missed" after two quiet weeks. What was sent, who said no, and the accounts that
-- may be due, for the function. Only the service role reads or writes them.
CREATE TABLE IF NOT EXISTS public.lifecycle_email_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind)
);
ALTER TABLE public.lifecycle_email_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lifecycle_email_log FROM anon, authenticated;
GRANT ALL ON public.lifecycle_email_log TO service_role;

CREATE TABLE IF NOT EXISTS public.email_optouts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.email_optouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_optouts FROM anon, authenticated;
GRANT ALL ON public.email_optouts TO service_role;

-- Accounts with a confirmed e-mail that are new (10 days) or went quiet 13–22 days ago. The last
-- use is the newest refresh of a signed-in session; with none, the account's own creation.
CREATE OR REPLACE FUNCTION public.lifecycle_candidates()
RETURNS TABLE (id uuid, email text, created_at timestamptz, last_used timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH accounts AS (
    SELECT u.id, u.email::text AS email, u.created_at,
      (SELECT max(s.updated_at) FROM auth.sessions s WHERE s.user_id = u.id) AS last_used
    FROM auth.users u
    WHERE u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
  )
  SELECT a.id, a.email, a.created_at, a.last_used
  FROM accounts a
  WHERE a.created_at > now() - interval '10 days'
     OR coalesce(a.last_used, a.created_at) BETWEEN now() - interval '22 days' AND now() - interval '13 days';
$$;
REVOKE ALL ON FUNCTION public.lifecycle_candidates() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lifecycle_candidates() TO service_role;

-- Every hour at :23. The bearer token is the public anon key, as for the other schedules; the
-- function sends only what is due, once, so an extra call does nothing.
SELECT cron.unschedule('crimealert-lifecycle-emails')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crimealert-lifecycle-emails');
SELECT cron.schedule(
  'crimealert-lifecycle-emails',
  '23 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pqoiwiiydtikouzjrllx.supabase.co/functions/v1/lifecycle-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxb2l3aWl5ZHRpa291empybGx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQzMTEsImV4cCI6MjA4NzAxMDMxMX0._hZ5CWcDEpWPgk6hSUBHbsbA1ymu7LYfXkFUxgACohk'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
