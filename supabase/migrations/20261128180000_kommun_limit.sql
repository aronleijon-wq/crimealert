-- A free account watches at most 2 kommuner (planFacts FREE_KOMMUN_LIMIT); Pro has no limit. The
-- app and the website say so before it happens; this makes sure of it. Kommuner watched before
-- the limit stay: only adding one more is stopped. Pro is what pro_status says (check-subscription
-- and the Apple functions keep it current; 'infinity' for Pro for good).
CREATE OR REPLACE FUNCTION public.notification_preferences_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.notification_preferences WHERE user_id = NEW.user_id) >= 2
     AND NOT EXISTS (SELECT 1 FROM public.pro_status p WHERE p.user_id = NEW.user_id AND p.pro_until > now())
  THEN
    RAISE EXCEPTION 'kommun_limit' USING HINT = 'Gratis kan bevaka 2 kommuner. Fler med Pro.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notification_preferences_limit() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS notification_preferences_limit ON public.notification_preferences;
CREATE TRIGGER notification_preferences_limit
  BEFORE INSERT ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.notification_preferences_limit();
