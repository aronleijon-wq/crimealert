DROP POLICY IF EXISTS "Authenticated users can read reviews" ON public.reviews;
CREATE POLICY "Anyone can read reviews" ON public.reviews
  FOR SELECT TO public USING (true);