-- Moderation of what users write, as Apple requires of apps with user content (guideline 1.2):
-- anyone signed in can report a comment or citizen report, or block its author. What they
-- report or block disappears for them at once; a post three people have reported is hidden for
-- everyone until an admin has looked at it; admins see the reports, remove posts or dismiss the
-- reports. Comments and reports with slurs are refused. No existing rows change.

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('comment', 'community_report')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('offensive', 'threat', 'spam', 'false', 'other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'removed', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)
);
CREATE INDEX IF NOT EXISTS content_reports_target_idx ON public.content_reports (target_type, target_id);
CREATE INDEX IF NOT EXISTS content_reports_open_idx ON public.content_reports (created_at) WHERE status = 'open';
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users report content" ON public.content_reports;
CREATE POLICY "Users report content" ON public.content_reports
  FOR INSERT TO authenticated WITH CHECK (reporter_id = (SELECT auth.uid()) AND status = 'open');
DROP POLICY IF EXISTS "Users see own reports, admins all" ON public.content_reports;
CREATE POLICY "Users see own reports, admins all" ON public.content_reports
  FOR SELECT TO authenticated USING (reporter_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'));
DROP POLICY IF EXISTS "Admins handle reports" ON public.content_reports;
CREATE POLICY "Admins handle reports" ON public.content_reports
  FOR UPDATE TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
GRANT SELECT, INSERT, UPDATE ON public.content_reports TO authenticated;

-- Blocks of a citizen report's author keep the report it was made from in via_report and are
-- never readable directly, so blocking doesn't tell who wrote the report (reports are anonymous).
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  via_report uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own blocks" ON public.user_blocks;
CREATE POLICY "Users manage own blocks" ON public.user_blocks
  FOR ALL TO authenticated
  USING (blocker_id = (SELECT auth.uid()) AND via_report IS NULL)
  WITH CHECK (blocker_id = (SELECT auth.uid()) AND via_report IS NULL);
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;

-- Whether a post is hidden for the one asking: its author is blocked, they reported it
-- themselves, or three people have reported it and no admin has dismissed the reports.
CREATE OR REPLACE FUNCTION public.content_hidden(_type text, _id uuid, _author uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_blocks b WHERE b.blocker_id = auth.uid() AND b.blocked_id = _author)
  OR EXISTS (
    SELECT 1 FROM public.content_reports r
    WHERE r.target_type = _type AND r.target_id = _id AND r.reporter_id = auth.uid() AND r.status <> 'dismissed'
  )
  OR (
    SELECT count(*) FROM public.content_reports r
    WHERE r.target_type = _type AND r.target_id = _id AND r.status = 'open'
  ) >= 3
$$;
REVOKE ALL ON FUNCTION public.content_hidden(text, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.content_hidden(text, uuid, uuid) TO anon, authenticated;

-- Comments: hidden ones are left out, except for their author and admins
DROP POLICY IF EXISTS "Authenticated users can read comments" ON public.incident_comments;
CREATE POLICY "Authenticated users can read comments" ON public.incident_comments
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin')
    OR NOT public.content_hidden('comment', id, user_id)
  );
DROP POLICY IF EXISTS "Admins can delete comments" ON public.incident_comments;
CREATE POLICY "Admins can delete comments" ON public.incident_comments
  FOR DELETE TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));

-- Citizen reports: the same, through the function the app reads them with (same columns as before)
CREATE OR REPLACE FUNCTION public.community_reports_visible()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  category text,
  area text,
  status text,
  lat double precision,
  lng double precision,
  created_at timestamptz,
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.title, r.description, r.category, r.area, r.status, r.lat, r.lng, r.created_at, r.image_url
  FROM public.community_reports r
  WHERE r.user_id = auth.uid()
     OR public.has_role(auth.uid(), 'admin')
     OR (public.has_pro(auth.uid()) AND NOT public.content_hidden('community_report', r.id, r.user_id))
$$;
REVOKE ALL ON FUNCTION public.community_reports_visible() FROM public;
GRANT EXECUTE ON FUNCTION public.community_reports_visible() TO anon, authenticated;

DROP POLICY IF EXISTS "Admins can delete reports" ON public.community_reports;
CREATE POLICY "Admins can delete reports" ON public.community_reports
  FOR DELETE TO authenticated USING (public.has_role((SELECT auth.uid()), 'admin'));

-- Blocking the author of a citizen report without learning who it is
CREATE OR REPLACE FUNCTION public.block_report_author(_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _author uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;
  SELECT user_id INTO _author FROM public.community_reports WHERE id = _report_id;
  IF _author IS NULL OR _author = auth.uid() THEN
    RETURN;
  END IF;
  INSERT INTO public.user_blocks (blocker_id, blocked_id, via_report) VALUES (auth.uid(), _author, _report_id)
  ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.block_report_author(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.block_report_author(uuid) TO authenticated;

-- The report blocks of the one asking, by report, and lifting one
CREATE OR REPLACE FUNCTION public.my_report_blocks()
RETURNS TABLE (report_id uuid, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.via_report, b.created_at FROM public.user_blocks b
  WHERE b.blocker_id = auth.uid() AND b.via_report IS NOT NULL
  ORDER BY b.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.my_report_blocks() FROM public;
GRANT EXECUTE ON FUNCTION public.my_report_blocks() TO authenticated;

CREATE OR REPLACE FUNCTION public.unblock_report_author(_report_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.user_blocks WHERE blocker_id = auth.uid() AND via_report = _report_id
$$;
REVOKE ALL ON FUNCTION public.unblock_report_author(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.unblock_report_author(uuid) TO authenticated;

-- A writer whose post an admin removed can be shut out from writing more ("ejecting the user"
-- in Apple's words). They keep their account, and can still read and delete what they wrote.
CREATE TABLE IF NOT EXISTS public.posting_bans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid, -- the post that was removed
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.posting_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage posting bans" ON public.posting_bans;
CREATE POLICY "Admins manage posting bans" ON public.posting_bans
  FOR ALL TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'))
  WITH CHECK (public.has_role((SELECT auth.uid()), 'admin'));
GRANT SELECT, INSERT, DELETE ON public.posting_bans TO authenticated;

CREATE OR REPLACE FUNCTION public.is_posting_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.posting_bans WHERE user_id = _user_id)
$$;
REVOKE ALL ON FUNCTION public.is_posting_banned(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_posting_banned(uuid) TO authenticated, service_role;

-- Slurs are refused before they are posted (src/lib/moderation.ts has the same list)
CREATE OR REPLACE FUNCTION public.has_blocked_words(_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(coalesce(_text, '')) ~ '(^|[^a-zåäö])(n[i1]gg(er|a|ah|ers|as)?|negr(er|ern|erna)|svartskall(e|en|ar|arna)?|blatt(e|en|ar|arna)|zigenarjävl(ar|arna)?|bögjävl(ar|arna)?|fagg?ots?|kill yourself|kys)([^a-zåäö]|$)'
$$;

CREATE OR REPLACE FUNCTION public.refuse_blocked_comment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_posting_banned(NEW.user_id) THEN
    RAISE EXCEPTION 'posting_banned' USING ERRCODE = 'check_violation';
  END IF;
  IF public.has_blocked_words(NEW.text) THEN
    RAISE EXCEPTION 'blocked_words' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.refuse_blocked_report()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF public.is_posting_banned(NEW.user_id) THEN
    RAISE EXCEPTION 'posting_banned' USING ERRCODE = 'check_violation';
  END IF;
  IF public.has_blocked_words(NEW.title) OR public.has_blocked_words(NEW.description) THEN
    RAISE EXCEPTION 'blocked_words' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refuse_blocked_words ON public.incident_comments;
CREATE TRIGGER refuse_blocked_words BEFORE INSERT OR UPDATE OF text ON public.incident_comments
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_comment();
DROP TRIGGER IF EXISTS refuse_blocked_words ON public.community_reports;
CREATE TRIGGER refuse_blocked_words BEFORE INSERT OR UPDATE OF title, description ON public.community_reports
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_report();

-- Display names are shown with comments, so a new name gets the same check. Only names people
-- type themselves: sign-up copies the name from Google or Apple and is left alone, and so is a
-- name already saved.
CREATE OR REPLACE FUNCTION public.refuse_blocked_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_blocked_words(NEW.display_name) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.display_name IS NOT DISTINCT FROM OLD.display_name THEN
      RETURN NEW;
    END IF;
  END IF;
  RAISE EXCEPTION 'blocked_words' USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS refuse_blocked_words ON public.profiles;
CREATE TRIGGER refuse_blocked_words BEFORE INSERT OR UPDATE OF display_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.refuse_blocked_name();