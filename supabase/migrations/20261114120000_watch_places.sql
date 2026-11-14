-- Mina platser: named places to watch, such as home, work and the children's school, each with
-- its own distance. A notification says which place an event is near ("600 m från Hem").
-- Matched in send-push-notifications (_shared/notifications.ts). Free accounts use their first
-- place, Pro up to five; at most ten are kept per account.
-- The place is kept to about a hundred metres, enough to draw a circle around and no more.

CREATE TABLE IF NOT EXISTS public.watch_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('home', 'work', 'school', 'family', 'other')),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  radius_km real NOT NULL CHECK (radius_km > 0 AND radius_km <= 50),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watch_places_user_idx ON public.watch_places (user_id, created_at);

ALTER TABLE public.watch_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their own places" ON public.watch_places;
CREATE POLICY "Users read their own places" ON public.watch_places
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users add their own places" ON public.watch_places;
CREATE POLICY "Users add their own places" ON public.watch_places
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users change their own places" ON public.watch_places;
CREATE POLICY "Users change their own places" ON public.watch_places
  FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "Users remove their own places" ON public.watch_places;
CREATE POLICY "Users remove their own places" ON public.watch_places
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_places TO authenticated;
GRANT ALL ON public.watch_places TO service_role;

-- Kept to about a hundred metres, and at most ten places per account
CREATE OR REPLACE FUNCTION public.watch_places_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.lat := round(NEW.lat::numeric, 3)::double precision;
  NEW.lng := round(NEW.lng::numeric, 3)::double precision;
  NEW.label := btrim(NEW.label);
  IF TG_OP = 'INSERT' AND (SELECT count(*) FROM public.watch_places WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'too_many_places' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS watch_places_guard ON public.watch_places;
CREATE TRIGGER watch_places_guard
  BEFORE INSERT OR UPDATE ON public.watch_places
  FOR EACH ROW EXECUTE FUNCTION public.watch_places_guard();

-- Each "Nära dig" circle becomes a place, and the circle is cleared so it isn't matched twice
INSERT INTO public.watch_places (user_id, label, kind, lat, lng, radius_km)
SELECT s.user_id, 'Min plats', 'other', s.near_lat, s.near_lng, LEAST(s.near_radius_km, 50)
FROM public.notification_settings s
WHERE s.near_lat IS NOT NULL AND s.near_lng IS NOT NULL AND s.near_radius_km IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.watch_places p WHERE p.user_id = s.user_id);

UPDATE public.notification_settings
SET near_lat = NULL, near_lng = NULL, near_radius_km = NULL
WHERE near_lat IS NOT NULL;
