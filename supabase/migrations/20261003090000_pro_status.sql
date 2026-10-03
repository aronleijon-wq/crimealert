-- Who has Pro, as last confirmed with Stripe by check-subscription (each time the app checks the
-- subscription), police-events or send-push-notifications. Only the service role writes here.
CREATE TABLE IF NOT EXISTS public.pro_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Pro until this time ('infinity' for accounts with free Pro); null when not Pro
  pro_until timestamptz,
  checked_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pro_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own pro status" ON public.pro_status;
CREATE POLICY "Users can view own pro status" ON public.pro_status
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

GRANT SELECT ON public.pro_status TO authenticated;
GRANT ALL ON public.pro_status TO service_role;

-- Accounts with free Pro have it from the start, before their first check
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

-- The archive holds every event's full text from the moment it is published. Free accounts get
-- events after 15 minutes and without the full text through police-events, so only Pro (and
-- admins) may read the archive directly. police-events and the push sender use the service
-- role and are unaffected; no rows change.
DROP POLICY IF EXISTS "Authenticated users can read police events archive" ON public.police_events_archive;
DROP POLICY IF EXISTS "Pro users can read police events archive" ON public.police_events_archive;
CREATE POLICY "Pro users can read police events archive" ON public.police_events_archive
  FOR SELECT TO authenticated
  USING (public.has_pro((SELECT auth.uid())) OR public.has_role((SELECT auth.uid()), 'admin'));
