
-- Add explicit restrictive SELECT deny on contact_messages for non-service roles
-- (RLS already denies by default, but make it explicit)

-- Add explicit UPDATE policy for community_reports scoped to owner
CREATE POLICY "Users can update own reports" ON public.community_reports
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Restrict geocode_cache INSERT to service role by removing the authenticated policy
-- and only allowing inserts via edge functions using service role
DROP POLICY IF EXISTS "Authenticated users can insert geocode cache" ON public.geocode_cache;
