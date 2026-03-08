
-- Fix all RESTRICTIVE policies to PERMISSIVE

-- community_reports
DROP POLICY IF EXISTS "Users can read own reports" ON public.community_reports;
CREATE POLICY "Users can read own reports" ON public.community_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own reports" ON public.community_reports;
CREATE POLICY "Users can insert own reports" ON public.community_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own reports" ON public.community_reports;
CREATE POLICY "Users can update own reports" ON public.community_reports FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reports" ON public.community_reports;
CREATE POLICY "Users can delete own reports" ON public.community_reports FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- notification_preferences
DROP POLICY IF EXISTS "Users can view own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can view own notification preferences" ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can insert own notification preferences" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users can delete own notification preferences" ON public.notification_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- geocode_cache
DROP POLICY IF EXISTS "Anyone can read geocode cache" ON public.geocode_cache;
CREATE POLICY "Anyone can read geocode cache" ON public.geocode_cache FOR SELECT TO public USING (true);

-- reviews
DROP POLICY IF EXISTS "Users can read own reviews" ON public.reviews;
CREATE POLICY "Users can read own reviews" ON public.reviews FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can insert their own review" ON public.reviews;
CREATE POLICY "Authenticated users can insert their own review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own review" ON public.reviews;
CREATE POLICY "Users can update their own review" ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own review" ON public.reviews;
CREATE POLICY "Users can delete their own review" ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- contact_messages
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;
CREATE POLICY "Anyone can submit contact messages" ON public.contact_messages FOR INSERT TO public WITH CHECK ((length(name) <= 100) AND (length(email) <= 255) AND (length(message) <= 1000));
