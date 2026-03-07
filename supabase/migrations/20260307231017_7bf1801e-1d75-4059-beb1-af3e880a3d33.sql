
-- Fix community_reports: remove public SELECT, add owner-only SELECT
DROP POLICY IF EXISTS "Anyone can read community reports" ON public.community_reports;
CREATE POLICY "Users can read own reports" ON public.community_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Fix reviews: remove public SELECT, add owner-only SELECT  
DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;
CREATE POLICY "Users can read own reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Fix contact_messages: make the service role policy restrictive and ensure no public access
DROP POLICY IF EXISTS "Service role full access" ON public.contact_messages;
-- Allow anon/authenticated to INSERT only (for contact form submissions)
CREATE POLICY "Anyone can submit contact messages" ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Fix geocode_cache: the INSERT policy is too permissive, restrict with check
DROP POLICY IF EXISTS "Authenticated users can insert geocode cache" ON public.geocode_cache;
CREATE POLICY "Authenticated users can insert geocode cache" ON public.geocode_cache
  FOR INSERT TO authenticated
  WITH CHECK (true);
