-- Medborgarrapporter for everyone signed in, not only Pro: reading them (here) and sending them
-- (submit-community-report). Reports grow only when many can send and see them.
-- A report can now say which police event it is about (event_id, the app's id for the event:
-- "Är du på plats?" on an event), so the event shows what people on the spot saw.
-- No rows change.

ALTER TABLE public.community_reports ADD COLUMN IF NOT EXISTS event_id text;
ALTER TABLE public.community_reports DROP CONSTRAINT IF EXISTS community_reports_event_id_check;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_event_id_check CHECK (event_id IS NULL OR event_id ~ '^[A-Za-z0-9:._-]{1,100}$');
CREATE INDEX IF NOT EXISTS community_reports_event_id_idx ON public.community_reports (event_id) WHERE event_id IS NOT NULL;
-- How many reports an account sent lately (submit-community-report's limit)
CREATE INDEX IF NOT EXISTS community_reports_user_created_idx ON public.community_reports (user_id, created_at DESC);

-- The function and the view gain a column, so both are made anew (same grants as before)
DROP VIEW IF EXISTS public.community_reports_public;
DROP FUNCTION IF EXISTS public.community_reports_visible();

CREATE FUNCTION public.community_reports_visible()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  category text,
  area text,
  status text,
  lat double precision,
  lng double precision,
  created_at timestamptz,
  image_url text,
  event_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Never the author: everyone signed in sees the reports, minus what moderation hides and the
  -- writers the reader has blocked (content_hidden); the author and admins see their own as is
  SELECT r.id, r.title, r.description, r.category, r.area, r.status, r.lat, r.lng, r.created_at, r.image_url, r.event_id
  FROM public.community_reports r
  WHERE r.user_id = auth.uid()
     OR public.has_role(auth.uid(), 'admin')
     OR (auth.uid() IS NOT NULL AND NOT public.content_hidden('community_report', r.id, r.user_id))
$$;
REVOKE ALL ON FUNCTION public.community_reports_visible() FROM public;
GRANT EXECUTE ON FUNCTION public.community_reports_visible() TO anon, authenticated;

CREATE VIEW public.community_reports_public WITH (security_invoker = true) AS
SELECT id, title, description, category, area, status, lat, lng, created_at, image_url, event_id
FROM public.community_reports_visible();
GRANT SELECT ON public.community_reports_public TO anon, authenticated;
