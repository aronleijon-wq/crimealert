
-- Fix 1: Add admin-only SELECT policy on contact_messages
CREATE POLICY "Only admins can read contact messages"
ON public.contact_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Fix 2: Update storage INSERT policy to enforce path ownership
DROP POLICY "Authenticated users can upload report images" ON storage.objects;
CREATE POLICY "Authenticated users can upload report images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'community-reports' AND (storage.foldername(name))[1] = auth.uid()::text);
