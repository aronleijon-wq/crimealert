DROP POLICY IF EXISTS "Anyone can read reviews" ON public.reviews;
CREATE POLICY "Authenticated users can read reviews" ON public.reviews
  FOR SELECT TO authenticated USING (true);