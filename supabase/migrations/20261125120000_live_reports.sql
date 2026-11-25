-- "Pågår nu" (_shared/liveNow): the reports of the last 90 minutes with a place, for the live card
-- in the app and on the site. Who reported is never given: "reporter" is only a number that is the
-- same for the same person within one answer, so the app can count how many different people are
-- there. The same reports are hidden as in community_reports_visible (moderation, blocked writers).
CREATE OR REPLACE FUNCTION public.live_reports()
RETURNS TABLE (
  id uuid,
  category text,
  area text,
  lat double precision,
  lng double precision,
  created_at timestamptz,
  event_id text,
  reporter integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.category, r.area, r.lat, r.lng, r.created_at, r.event_id,
         (dense_rank() OVER (ORDER BY md5(r.user_id::text || now()::text)))::integer AS reporter
  FROM public.community_reports r
  WHERE r.created_at > now() - interval '90 minutes'
    AND r.lat IS NOT NULL AND r.lng IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (r.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR NOT public.content_hidden('community_report', r.id, r.user_id))
  ORDER BY r.created_at DESC
  LIMIT 1000
$$;
REVOKE ALL ON FUNCTION public.live_reports() FROM public;
GRANT EXECUTE ON FUNCTION public.live_reports() TO authenticated;
