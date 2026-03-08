
DROP POLICY "Users can read own reviews" ON public.reviews;

CREATE POLICY "Anyone can read reviews" ON public.reviews
  FOR SELECT USING (true);
