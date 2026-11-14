-- The admin export ("Sedan start" in Analys) takes the whole police archive. Pro users still read
-- the last 65 days, as the app asks for 60 at most; admins read all of it. The checks stay wrapped
-- in SELECT so they run once per query, not once per row.
DROP POLICY IF EXISTS "Pro users can read police events archive" ON public.police_events_archive;
CREATE POLICY "Pro users can read police events archive" ON public.police_events_archive
  FOR SELECT TO authenticated
  USING (
    (SELECT public.has_role((SELECT auth.uid()), 'admin'))
    OR ((SELECT public.has_pro((SELECT auth.uid()))) AND time > now() - interval '65 days')
  );
