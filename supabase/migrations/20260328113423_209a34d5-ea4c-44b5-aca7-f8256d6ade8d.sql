
-- Restrict police_events_archive to authenticated users only
DROP POLICY IF EXISTS "Anyone can read police events archive" ON public.police_events_archive;
CREATE POLICY "Authenticated users can read police events archive"
ON public.police_events_archive
FOR SELECT
TO authenticated
USING (true);
