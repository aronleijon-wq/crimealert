-- lovable-cron-fallback-reviewed: health check every 10 min is a deliberate requirement (user wants downtime alarms within 30 min); hourly would delay detection too much
-- 20261003090000_pro_status.sql
CREATE TABLE IF NOT EXISTS public.pro_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pro_until timestamptz,
  checked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own pro status" ON public.pro_status;
CREATE POLICY "Users can view own pro status" ON public.pro_status
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
GRANT SELECT ON public.pro_status TO authenticated;
GRANT ALL ON public.pro_status TO service_role;
INSERT INTO public.pro_status (user_id, pro_until)
SELECT id, 'infinity'::timestamptz
FROM auth.users
WHERE lower(email) IN (
  'aronleijon@icloud.com', 'oscaralvenius@outlook.com', 'carlmrski@gmail.com', 'stefanlasse67@gmail.com',
  'kristensson91@hotmail.com', 'mykhailo@inphiz.com', 'kcleijon@gmail.com'
)
ON CONFLICT (user_id) DO UPDATE SET pro_until = EXCLUDED.pro_until, checked_at = now();
CREATE OR REPLACE FUNCTION public.has_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pro_status WHERE user_id = _user_id AND pro_until > now()
  )
$$;
REVOKE ALL ON FUNCTION public.has_pro(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.has_pro(uuid) TO authenticated, service_role;
DROP POLICY IF EXISTS "Authenticated users can read police events archive" ON public.police_events_archive;
DROP POLICY IF EXISTS "Pro users can read police events archive" ON public.police_events_archive;
CREATE POLICY "Pro users can read police events archive" ON public.police_events_archive
  FOR SELECT TO authenticated
  USING (public.has_pro((SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'));

-- 20261003100000_weekly_summary.sql
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS weekly_summary boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS public.weekly_summary_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week)
);
ALTER TABLE public.weekly_summary_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.weekly_summary_log TO service_role;
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

-- 20261003110000_client_monitoring.sql
CREATE TABLE IF NOT EXISTS public.page_stats (
  day date NOT NULL,
  page text NOT NULL,
  device text NOT NULL,
  views integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, page, device)
);
CREATE TABLE IF NOT EXISTS public.client_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('error', 'vital')),
  page text NOT NULL,
  name text NOT NULL,
  value double precision,
  detail text,
  device text NOT NULL
);
CREATE INDEX IF NOT EXISTS client_events_created_at_idx ON public.client_events (created_at);
ALTER TABLE public.page_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read page stats" ON public.page_stats;
CREATE POLICY "Admins can read page stats" ON public.page_stats
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
DROP POLICY IF EXISTS "Admins can read client events" ON public.client_events;
CREATE POLICY "Admins can read client events" ON public.client_events
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
GRANT SELECT ON public.page_stats, public.client_events TO authenticated;
GRANT ALL ON public.page_stats, public.client_events TO service_role;
CREATE OR REPLACE FUNCTION public.track_page_view(_page text, _device text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _page IS NULL OR length(_page) > 80 OR _page !~ '^/' OR _device NOT IN ('mobile', 'desktop') THEN
    RETURN;
  END IF;
  INSERT INTO public.page_stats (day, page, device, views)
  VALUES ((now() AT TIME ZONE 'Europe/Stockholm')::date, _page, _device, 1)
  ON CONFLICT (day, page, device) DO UPDATE SET views = page_stats.views + 1;
END;
$$;
CREATE OR REPLACE FUNCTION public.log_client_event(_kind text, _page text, _name text, _value double precision, _detail text, _device text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _kind NOT IN ('error', 'vital') OR _device NOT IN ('mobile', 'desktop')
     OR _page IS NULL OR length(_page) > 80 OR _name IS NULL OR length(_name) = 0 THEN
    RETURN;
  END IF;
  IF _kind = 'vital' AND (_name NOT IN ('LCP', 'INP', 'CLS', 'FCP', 'TTFB') OR _value IS NULL OR _value < 0 OR _value > 120000) THEN
    RETURN;
  END IF;
  IF (SELECT count(*) FROM public.client_events WHERE created_at > now() - interval '1 minute') >= 120 THEN
    RETURN;
  END IF;
  INSERT INTO public.client_events (kind, page, name, value, detail, device)
  VALUES (_kind, _page, left(_name, 300), _value, left(_detail, 1000), _device);
END;
$$;
REVOKE ALL ON FUNCTION public.track_page_view(text, text) FROM public;
REVOKE ALL ON FUNCTION public.log_client_event(text, text, text, double precision, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.track_page_view(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_client_event(text, text, text, double precision, text, text) TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.monitoring_summary(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - make_interval(days => greatest(1, least(_days, 30)));
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  RETURN jsonb_build_object(
    'views_by_day', (
      SELECT coalesce(jsonb_agg(d ORDER BY d->>'day'), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('day', day, 'mobile', sum(views) FILTER (WHERE device = 'mobile'), 'desktop', sum(views) FILTER (WHERE device = 'desktop')) AS d
        FROM public.page_stats WHERE day >= since::date GROUP BY day
      ) days
    ),
    'top_pages', (
      SELECT coalesce(jsonb_agg(p ORDER BY (p->>'views')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('page', page, 'views', sum(views)) AS p
        FROM public.page_stats WHERE day >= since::date GROUP BY page ORDER BY sum(views) DESC LIMIT 12
      ) pages
    ),
    'vitals', (
      SELECT coalesce(jsonb_agg(v), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('name', name, 'device', device, 'p75', percentile_cont(0.75) WITHIN GROUP (ORDER BY value), 'samples', count(*)) AS v
        FROM public.client_events WHERE kind = 'vital' AND created_at >= since GROUP BY name, device
      ) vitals
    ),
    'errors', (
      SELECT coalesce(jsonb_agg(e ORDER BY (e->>'count')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('name', name, 'count', count(*), 'last_seen', max(created_at), 'pages', array_agg(DISTINCT page), 'detail', max(detail)) AS e
        FROM public.client_events WHERE kind = 'error' AND created_at >= since GROUP BY name ORDER BY count(*) DESC LIMIT 20
      ) errors
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.monitoring_summary(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.monitoring_summary(integer) TO authenticated;
SELECT cron.unschedule('crimealert-monitoring-cleanup')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'crimealert-monitoring-cleanup');
SELECT cron.schedule(
  'crimealert-monitoring-cleanup',
  '17 3 * * *',
  $$
  DELETE FROM public.client_events WHERE created_at < now() - interval '30 days';
  DELETE FROM public.page_stats WHERE day < (now() - interval '30 days')::date;
  $$
);

-- 20261003120000_police_health.sql
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