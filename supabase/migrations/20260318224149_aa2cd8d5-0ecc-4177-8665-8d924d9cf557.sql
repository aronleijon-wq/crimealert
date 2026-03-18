
-- Fix: Recreate view with SECURITY INVOKER to use querying user's permissions
DROP VIEW IF EXISTS public.community_reports_public;
CREATE VIEW public.community_reports_public WITH (security_invoker = true) AS
SELECT id, title, description, category, area, status, lat, lng, created_at, image_url
FROM public.community_reports;

GRANT SELECT ON public.community_reports_public TO anon, authenticated;
