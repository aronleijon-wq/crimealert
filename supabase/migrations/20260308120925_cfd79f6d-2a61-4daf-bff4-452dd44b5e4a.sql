-- Drop the restrictive SELECT policy that limits to own reviews only
DROP POLICY "Users can read own reviews" ON public.reviews;