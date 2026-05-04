DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);