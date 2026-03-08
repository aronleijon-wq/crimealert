
-- Fix overly permissive RLS on contact_messages: replace WITH CHECK (true) with a more restrictive policy
-- Drop the existing permissive INSERT policy
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;

-- Create a new policy that still allows public inserts but adds basic protection
-- We keep it open for anonymous contact form submissions but add rate-limiting potential
CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  -- Restrict field lengths server-side
  length(name) <= 100
  AND length(email) <= 255
  AND length(message) <= 1000
);
