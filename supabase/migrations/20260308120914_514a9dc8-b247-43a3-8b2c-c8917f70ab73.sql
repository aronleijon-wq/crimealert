-- Add a permissive policy so everyone (including anon) can read reviews
CREATE POLICY "Anyone can read reviews"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (true);