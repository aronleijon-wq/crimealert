
-- Allow all authenticated users to read community reports (so Pro members can see all reports, not just their own)
CREATE POLICY "Authenticated users can read all reports"
ON public.community_reports
FOR SELECT
TO authenticated
USING (true);
