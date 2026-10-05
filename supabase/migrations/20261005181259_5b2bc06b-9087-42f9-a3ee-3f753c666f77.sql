-- Keep the police archive instead of deleting events after 35 days. Polisen's API only has its
-- 500 most recent events, so a longer history exists only if it is kept here; it is what
-- statistics further back, or data for others, can be built on. No existing row is changed.
DROP TRIGGER IF EXISTS trg_cleanup_old_police_events ON public.police_events_archive;
DROP FUNCTION IF EXISTS public.cleanup_old_police_events() CASCADE;

-- Two lookups go by when an event was archived: the push sender's new events in the last hour,
-- and the newest event on the admin page. Without an index both read the whole table, which
-- only stayed cheap while it held 35 days.
CREATE INDEX IF NOT EXISTS idx_police_events_archive_created_at
  ON public.police_events_archive (created_at DESC);

-- What the app can read: the last 65 days, as it asks for 60 at most (the map's timeline,
-- Analys and the export). The older history is kept, not served. Edge functions read with the
-- service role, past this policy. The Pro and admin checks are wrapped in SELECT so they run
-- once per query, not once per row.
DROP POLICY IF EXISTS "Pro users can read police events archive" ON public.police_events_archive;
CREATE POLICY "Pro users can read police events archive" ON public.police_events_archive
  FOR SELECT TO authenticated
  USING (
    ((SELECT public.has_pro((SELECT auth.uid()))) OR (SELECT public.has_role((SELECT auth.uid()), 'admin')))
    AND time > now() - interval '65 days'
  );