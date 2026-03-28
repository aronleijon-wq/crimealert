
-- Restrict incident_reactions SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can read reactions" ON public.incident_reactions;
CREATE POLICY "Authenticated users can read reactions"
ON public.incident_reactions
FOR SELECT
TO authenticated
USING (true);

-- Restrict incident_comments SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can read comments" ON public.incident_comments;
CREATE POLICY "Authenticated users can read comments"
ON public.incident_comments
FOR SELECT
TO authenticated
USING (true);

-- Restrict comment_likes SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can read likes" ON public.comment_likes;
CREATE POLICY "Authenticated users can read likes"
ON public.comment_likes
FOR SELECT
TO authenticated
USING (true);
