-- Medborgarrapporter: who wrote a report, and where, is no longer open to every signed-in account.
-- No rows change.
--
-- Until now any signed-in account, free ones too, could read the whole table directly, with the
-- author's user id and exact position, although the app shows other people's reports only to Pro.
-- Now the table itself is read only by its author and by admins. Everyone else reads the list
-- through community_reports_public as before: same name and columns, never the author, and all
-- reports only for Pro and admins (as the app does), otherwise only the reader's own.

DROP POLICY IF EXISTS "Authenticated users can read all reports" ON public.community_reports;
DROP POLICY IF EXISTS "Admins can read all reports" ON public.community_reports;
CREATE POLICY "Admins can read all reports" ON public.community_reports
  FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));
-- "Users can read own reports" stays as it is

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

-- Report images stay public by their link, which is all the app uses. Listing the bucket is now
-- only possible for your own folder, so nobody can list every image and who uploaded it.
DROP POLICY IF EXISTS "Public read access for report images" ON storage.objects;
DROP POLICY IF EXISTS "Users can list own report images" ON storage.objects;
CREATE POLICY "Users can list own report images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'community-reports' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
