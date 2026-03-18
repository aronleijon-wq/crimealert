
-- Add image_url column to community_reports
ALTER TABLE public.community_reports ADD COLUMN image_url text DEFAULT NULL;

-- Create storage bucket for community report images
INSERT INTO storage.buckets (id, name, public) VALUES ('community-reports', 'community-reports', true);

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload report images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'community-reports');

-- Allow public read access
CREATE POLICY "Public read access for report images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'community-reports');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own report images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'community-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Recreate the public view to include image_url
DROP VIEW IF EXISTS public.community_reports_public;
CREATE VIEW public.community_reports_public AS
SELECT id, title, description, category, area, status, lat, lng, created_at, image_url
FROM public.community_reports;

-- Grant access
GRANT SELECT ON public.community_reports_public TO anon, authenticated;
