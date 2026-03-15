
CREATE OR REPLACE FUNCTION public.cleanup_old_police_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.police_events_archive WHERE time < NOW() - INTERVAL '35 days';
  RETURN NEW;
END;
$$;
