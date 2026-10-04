DROP POLICY IF EXISTS "Authenticated users can read all reports" ON public.community_reports;
DROP POLICY IF EXISTS "Admins can read all reports" ON public.community_reports;
CREATE POLICY "Admins can read all reports" ON public.community_reports
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE OR REPLACE FUNCTION public.community_reports_visible()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  category text,
  area text,
  status text,
  lat double precision,
  lng double precision,
  created_at timestamptz,
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.title, r.description, r.category, r.area, r.status, r.lat, r.lng, r.created_at, r.image_url
  FROM public.community_reports r
  WHERE r.user_id = auth.uid()
     OR public.has_pro(auth.uid())
     OR public.has_role(auth.uid(), 'admin')
$$;
REVOKE ALL ON FUNCTION public.community_reports_visible() FROM public;
GRANT EXECUTE ON FUNCTION public.community_reports_visible() TO anon, authenticated;

CREATE OR REPLACE VIEW public.community_reports_public WITH (security_invoker = true) AS
SELECT id, title, description, category, area, status, lat, lng, created_at, image_url
FROM public.community_reports_visible();
GRANT SELECT ON public.community_reports_public TO anon, authenticated;

DROP POLICY IF EXISTS "Public read access for report images" ON storage.objects;
DROP POLICY IF EXISTS "Users can list own report images" ON storage.objects;
CREATE POLICY "Users can list own report images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'community-reports' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);