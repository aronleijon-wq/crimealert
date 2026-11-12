-- The crime atlas (lib/crimeAtlas): Polisen's published events per place and category, counted
-- in the database so the page fetches a few thousand sums instead of every event. For the last
-- `_days` days and the same number of days before them, to see what rises. Open to everyone:
-- only counts leave the database, never the events themselves (whose archive is Pro's).
-- Events for a whole län and Polisen's daily summaries are left out; they say nothing about a kommun.
CREATE OR REPLACE FUNCTION public.crime_atlas(_days integer DEFAULT 30)
RETURNS TABLE (area text, category text, now_count integer, before_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (SELECT make_interval(days => least(greatest(coalesce(_days, 30), 1), 365)) AS span)
  SELECT
    e.area,
    coalesce(nullif(e.original_type, ''), e.type) AS category,
    count(*) FILTER (WHERE e.time > now() - p.span)::integer AS now_count,
    count(*) FILTER (WHERE e.time <= now() - p.span)::integer AS before_count
  FROM public.police_events_archive e, p
  WHERE e.time > now() - 2 * p.span
    AND e.time <= now()
    AND e.area IS NOT NULL
    AND e.area !~* '\mlän$'
    AND coalesce(nullif(e.original_type, ''), e.type) !~* 'sammanfattning'
  GROUP BY 1, 2;
$$;

REVOKE ALL ON FUNCTION public.crime_atlas(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crime_atlas(integer) TO anon, authenticated;
