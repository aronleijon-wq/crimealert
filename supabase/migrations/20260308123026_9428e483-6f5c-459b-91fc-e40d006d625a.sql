
DROP POLICY "Anyone can read reviews" ON public.reviews;

CREATE POLICY "Users can read own reviews" ON public.reviews
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
