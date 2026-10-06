-- Monthly reports per kommun (/kommun/malmo/2026-09): Polisen's events in a month, counted per
-- area, kind and day. Public, because they are sums and not the events themselves. The page
-- matches the areas against the kommun with the app's own rules (whole names, "Stockholms
-- län" counts for Stockholm); the ILIKE here only narrows the rows down.
CREATE OR REPLACE FUNCTION public.kommun_month_counts(_kommun text, _month date)
RETURNS TABLE (area text, type text, original_type text, day date, events integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.area, a.type, a.original_type, (a.time AT TIME ZONE 'Europe/Stockholm')::date AS day, count(*)::int AS events
  FROM public.police_events_archive a
  WHERE length(_kommun) BETWEEN 2 AND 40
    AND a.time >= (date_trunc('month', _month::timestamp) AT TIME ZONE 'Europe/Stockholm')
    AND a.time < ((date_trunc('month', _month::timestamp) + interval '1 month') AT TIME ZONE 'Europe/Stockholm')
    AND a.area ILIKE '%' || replace(replace(replace(_kommun, '\', '\\'), '%', '\%'), '_', '\_') || '%'
  GROUP BY 1, 2, 3, 4
$$;
REVOKE ALL ON FUNCTION public.kommun_month_counts(text, date) FROM public;
GRANT EXECUTE ON FUNCTION public.kommun_month_counts(text, date) TO anon, authenticated;

-- Where visits come from (a search engine, ChatGPT, an ad), counted per day: a source name and
-- a sum, no cookies and nothing about the visitor. Kept for 400 days; admins see the summary.
CREATE TABLE IF NOT EXISTS public.traffic_sources (
  day date NOT NULL,
  source text NOT NULL,
  visits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, source)
);
ALTER TABLE public.traffic_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.traffic_sources FROM anon, authenticated;
GRANT ALL ON public.traffic_sources TO service_role;

CREATE OR REPLACE FUNCTION public.track_visit_source(_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _source IS NULL OR _source !~ '^[a-z0-9][a-z0-9.-]{0,39}$' THEN
    RETURN;
  END IF;
  INSERT INTO public.traffic_sources (day, source, visits)
  VALUES ((now() AT TIME ZONE 'Europe/Stockholm')::date, _source, 1)
  ON CONFLICT (day, source) DO UPDATE SET visits = traffic_sources.visits + 1;
  DELETE FROM public.traffic_sources WHERE day < (now() AT TIME ZONE 'Europe/Stockholm')::date - 400;
END;
$$;
REVOKE ALL ON FUNCTION public.track_visit_source(text) FROM public;
GRANT EXECUTE ON FUNCTION public.track_visit_source(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.traffic_sources_summary(_days integer)
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
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('source', source, 'visits', visits) ORDER BY visits DESC, source)
    FROM (
      SELECT source, sum(visits)::int AS visits
      FROM public.traffic_sources
      WHERE day > (now() AT TIME ZONE 'Europe/Stockholm')::date - least(greatest(_days, 1), 400)
      GROUP BY source
    ) s
  ), '[]'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.traffic_sources_summary(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.traffic_sources_summary(integer) TO authenticated;