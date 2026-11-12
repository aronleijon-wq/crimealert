-- crime_atlas with the place as precisely as it is known (lib/crimeAtlas). Polisen puts many
-- events on a whole län ("Stockholms län"), almost all of Stockholm's among them, so the atlas
-- missed them. Besides the area, each sum now carries the town at the end of Polisen's title and,
-- when the event's position is better than the län's middle (a street, Polisen's own position or
-- a district), that position rounded to about a kilometre. The page places the event in a kommun
-- from these. Only sums leave the database, as before.
CREATE OR REPLACE FUNCTION public.crime_atlas_places(_days integer DEFAULT 30)
RETURNS TABLE (area text, place text, category text, lat double precision, lng double precision, now_count integer, before_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (SELECT make_interval(days => least(greatest(coalesce(_days, 30), 1), 365)) AS span),
  e AS (
    SELECT
      e.area,
      -- "12 november 08.15, Rån, Södertälje" → "Södertälje"
      nullif(btrim(regexp_replace(e.title, '^.*,', '')), '') AS place,
      coalesce(nullif(e.original_type, ''), e.type) AS category,
      CASE WHEN e.location_precision IN ('street', 'api', 'district') THEN round(e.lat::numeric, 2)::double precision END AS lat,
      CASE WHEN e.location_precision IN ('street', 'api', 'district') THEN round(e.lng::numeric, 2)::double precision END AS lng,
      e.time
    FROM public.police_events_archive e, p
    WHERE e.time > now() - 2 * p.span
      AND e.time <= now()
      AND e.area IS NOT NULL
  )
  SELECT
    e.area, e.place, e.category, e.lat, e.lng,
    count(*) FILTER (WHERE e.time > now() - p.span)::integer AS now_count,
    count(*) FILTER (WHERE e.time <= now() - p.span)::integer AS before_count
  FROM e, p
  WHERE e.category !~* 'sammanfattning'
  GROUP BY 1, 2, 3, 4, 5;
$$;

REVOKE ALL ON FUNCTION public.crime_atlas_places(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crime_atlas_places(integer) TO anon, authenticated;
