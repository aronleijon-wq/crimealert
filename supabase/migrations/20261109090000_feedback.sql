-- Feedback from the app and the website ("Tyck till"): a rating from 1 to 5 and, if they want,
-- a few words on what to make better. Shown to admins on /admin.
-- Anyone may send, signed in or not, but only through send_feedback, which checks what it gets
-- and how often: three a day for an account, and at most 300 a day without one.

CREATE TABLE IF NOT EXISTS public.feedback (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  message text CHECK (message IS NULL OR char_length(message) <= 1000),
  -- Where it was sent from: "app 1.3", "web"
  source text NOT NULL CHECK (char_length(source) <= 40)
);
CREATE INDEX IF NOT EXISTS feedback_created_at_idx ON public.feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_user_idx ON public.feedback (user_id, created_at);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can read feedback" ON public.feedback;
CREATE POLICY "Admins can read feedback" ON public.feedback
  FOR SELECT TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));
GRANT SELECT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

CREATE OR REPLACE FUNCTION public.send_feedback(_rating integer, _message text, _source text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  words text := nullif(btrim(coalesce(_message, '')), '');
BEGIN
  IF _rating IS NULL OR _rating NOT BETWEEN 1 AND 5 THEN RETURN 'invalid'; END IF;
  IF words IS NOT NULL AND char_length(words) > 1000 THEN words := left(words, 1000); END IF;
  IF uid IS NOT NULL THEN
    IF (SELECT count(*) FROM public.feedback WHERE user_id = uid AND created_at > now() - interval '1 day') >= 3 THEN
      RETURN 'too_many';
    END IF;
  ELSIF (SELECT count(*) FROM public.feedback WHERE user_id IS NULL AND created_at > now() - interval '1 day') >= 300 THEN
    RETURN 'too_many';
  END IF;
  INSERT INTO public.feedback (user_id, rating, message, source)
  VALUES (uid, _rating, words, left(coalesce(nullif(btrim(_source), ''), 'okänd'), 40));
  RETURN 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.send_feedback(integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_feedback(integer, text, text) TO anon, authenticated;
