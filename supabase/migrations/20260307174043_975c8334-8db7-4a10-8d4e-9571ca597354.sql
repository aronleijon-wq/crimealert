-- 1. Create views that hide user_id for public reads
CREATE VIEW public.reviews_public AS
SELECT id, display_name, rating, message, created_at
FROM public.reviews;

CREATE VIEW public.community_reports_public AS
SELECT id, title, description, category, area, lat, lng, status, created_at
FROM public.community_reports;

-- 2. Fix geocode_cache: restrict INSERT to authenticated users only
DROP POLICY IF EXISTS "Anyone can insert geocode cache" ON public.geocode_cache;
CREATE POLICY "Authenticated users can insert geocode cache"
ON public.geocode_cache
FOR INSERT
TO authenticated
WITH CHECK (true);