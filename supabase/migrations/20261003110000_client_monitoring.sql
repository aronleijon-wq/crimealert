-- Errors, loading times and page views from real visitors, without cookies and without
-- anything that identifies them. Shown to admins on /admin; kept for 30 days.

-- Page views as one counter per day, page and device type: a handful of rows a day
CREATE TABLE IF NOT EXISTS public.page_stats (
  day date NOT NULL,
  page text NOT NULL,
  device text NOT NULL,
  views integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, page, device)
);

-- Errors and sampled loading times, one row each
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

-- Visitors only write through these two functions, which check what they get
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
  -- A ceiling against floods: at most 120 rows a minute from everyone together
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

-- The admin page's summary of the last days, worked out in the database
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

-- Forget everything older than 30 days, every night
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
