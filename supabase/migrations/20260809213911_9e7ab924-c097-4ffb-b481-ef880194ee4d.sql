-- Block direct client-side inserts; creation now goes through the
-- submit-community-report edge function which verifies Pro status.
DROP POLICY IF EXISTS "Users can insert own reports" ON public.community_reports;
CREATE POLICY "No direct client insert" ON public.community_reports
  FOR INSERT TO authenticated WITH CHECK (false);

-- Restrict image_url to our own public storage bucket (blocks XSS/javascript: payloads)
ALTER TABLE public.community_reports
  DROP CONSTRAINT IF EXISTS community_reports_image_url_check;
ALTER TABLE public.community_reports
  ADD CONSTRAINT community_reports_image_url_check
  CHECK (
    image_url IS NULL
    OR image_url ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/community-reports/[A-Za-z0-9/._-]+$'
  );

GRANT SELECT, UPDATE, DELETE ON public.community_reports TO authenticated;
GRANT ALL ON public.community_reports TO service_role;