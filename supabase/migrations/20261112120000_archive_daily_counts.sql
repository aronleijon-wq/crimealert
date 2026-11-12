-- How full the police archive is, day by day: every event, and how many were for a whole län,
-- daily summaries, or without a place, which the crime atlas leaves out. Only counts, so it is
-- open to the admin page and to checks from outside; no event leaves the database.
CREATE OR REPLACE FUNCTION public.archive_daily_counts(_days integer DEFAULT 30)
RETURNS TABLE (day date, total integer, lan integer, summaries integer, no_area integer, kommun integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (e.time AT TIME ZONE 'Europe/Stockholm')::date AS day,
    count(*)::integer AS total,
    count(*) FILTER (WHERE e.area ~* '\mlän$')::integer AS lan,
    count(*) FILTER (WHERE coalesce(nullif(e.original_type, ''), e.type) ~* 'sammanfattning')::integer AS summaries,
    count(*) FILTER (WHERE e.area IS NULL OR e.area = '' OR e.area = 'Okänt område')::integer AS no_area,
    count(*) FILTER (
      WHERE e.area IS NOT NULL AND e.area <> '' AND e.area <> 'Okänt område'
        AND e.area !~* '\mlän$'
        AND coalesce(nullif(e.original_type, ''), e.type) !~* 'sammanfattning'
    )::integer AS kommun
  FROM public.police_events_archive e
  WHERE e.time > now() - make_interval(days => least(greatest(coalesce(_days, 30), 1), 400))
  GROUP BY 1
  ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION public.archive_daily_counts(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_daily_counts(integer) TO anon, authenticated;
