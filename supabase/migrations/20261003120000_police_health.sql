-- Warn when fetching from Polisen stops. police-events records each answer from Polisen in
-- ingest_state ('police'); this schedule looks at it every 10 minutes and only calls the push
-- sender when the admins should hear something: no answer for 30 minutes (again at most every
-- 6 hours), or working again after a warning. Normally it calls nothing.
SELECT cron.unschedule('crimealert-police-health')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crimealert-police-health');
SELECT cron.schedule(
  'crimealert-police-health',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://pqoiwiiydtikouzjrllx.supabase.co/functions/v1/send-push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxb2l3aWl5ZHRpa291empybGx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQzMTEsImV4cCI6MjA4NzAxMDMxMX0._hZ5CWcDEpWPgk6hSUBHbsbA1ymu7LYfXkFUxgACohk'
    ),
    body := '{"mode":"health"}'::jsonb,
    timeout_milliseconds := 60000
  )
  FROM (
    SELECT
      (SELECT last_run_at FROM public.ingest_state WHERE key = 'police') AS fetched,
      (SELECT last_run_at FROM public.ingest_state WHERE key = 'police-alert') AS alerted,
      (SELECT last_run_at FROM public.ingest_state WHERE key = 'police-recovered') AS recovered
  ) s
  WHERE s.fetched IS NOT NULL AND (
    (s.fetched < now() - interval '30 minutes' AND coalesce(s.alerted, 'epoch') < now() - interval '6 hours')
    OR (s.fetched >= now() - interval '30 minutes' AND s.alerted > coalesce(s.recovered, 'epoch'))
  );
  $$
);

-- The admin page also shows when Polisen last answered and the newest archived event
CREATE OR REPLACE FUNCTION public.police_fetch_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN jsonb_build_object(
    'fetched_at', (SELECT last_run_at FROM public.ingest_state WHERE key = 'police'),
    'alerted_at', (SELECT last_run_at FROM public.ingest_state WHERE key = 'police-alert'),
    'latest_event_at', (SELECT max(created_at) FROM public.police_events_archive)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.police_fetch_status() FROM public;
GRANT EXECUTE ON FUNCTION public.police_fetch_status() TO authenticated;
