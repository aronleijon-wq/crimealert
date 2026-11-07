-- Invite a friend: every account has a link of its own, crimealert.se/inbjudan/<code>. When a
-- friend makes a new account through it and has confirmed their e-mail, the one who invited
-- gets 7 days of Pro, for up to 8 friends (56 days). Days add up, and Pro from invites ends by
-- itself. The friend gets no Pro, but a link of their own to invite others with.
--
-- Rules, all enforced here: a code is used by a new account (made in the last 7 days), with a
-- confirmed e-mail, once per account, never by its owner, and never back to the one who
-- invited you. Only these functions write the tables; nobody reads them directly.

CREATE TABLE IF NOT EXISTS public.invite_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  -- Friends that gave Pro; never counts down, so deleted friends don't free a place
  rewarded integer NOT NULL DEFAULT 0 CHECK (rewarded BETWEEN 0 AND 8),
  -- Pro from invites until then (null before the first friend)
  pro_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invites (
  invitee_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rewarded boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (invitee_id <> inviter_id)
);
CREATE INDEX IF NOT EXISTS invites_inviter_idx ON public.invites (inviter_id);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.invite_codes TO service_role;
GRANT ALL ON public.invites TO service_role;

-- The signed-in user's link and how far they have come, the link made on first ask.
-- can_redeem: whether this account may still use someone else's code (new and not invited).
CREATE OR REPLACE FUNCTION public.my_invite()
RETURNS TABLE (code text, rewarded integer, pro_until timestamptz, can_redeem boolean)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  uid uuid := auth.uid();
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Logga in för att bjuda in.' USING ERRCODE = '42501';
  END IF;
  WHILE NOT EXISTS (SELECT 1 FROM public.invite_codes WHERE user_id = uid) LOOP
    SELECT string_agg(substr(alphabet, 1 + floor(random() * 32)::int, 1), '') INTO candidate FROM generate_series(1, 8);
    BEGIN
      INSERT INTO public.invite_codes (user_id, code) VALUES (uid, candidate) ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN unique_violation THEN
      -- Someone else has that code; draw another
    END;
  END LOOP;
  RETURN QUERY
    SELECT i.code, i.rewarded, i.pro_until,
           (NOT EXISTS (SELECT 1 FROM public.invites v WHERE v.invitee_id = uid)
             AND u.created_at > now() - interval '7 days')
    FROM public.invite_codes i
    JOIN auth.users u ON u.id = i.user_id
    WHERE i.user_id = uid;
END;
$$;

-- Using a friend's code. Returns what happened: 'ok', 'invalid' (no such code), 'self',
-- 'already' (this account was invited before), 'too_old' (not a new account), 'unconfirmed'
-- (e-mail not confirmed yet; try again later) or 'signed_out'.
CREATE OR REPLACE FUNCTION public.redeem_invite(_code text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  confirmed timestamptz;
  joined timestamptz;
  inviter uuid;
  earned integer;
  until timestamptz;
BEGIN
  IF uid IS NULL THEN RETURN 'signed_out'; END IF;
  SELECT email_confirmed_at, created_at INTO confirmed, joined FROM auth.users WHERE id = uid;
  IF confirmed IS NULL THEN RETURN 'unconfirmed'; END IF;

  -- Locks the inviter's row, so two friends at once can't both take the eighth place
  SELECT user_id, rewarded INTO inviter, earned
    FROM public.invite_codes
    WHERE code = upper(regexp_replace(coalesce(_code, ''), '[^A-Za-z0-9]', '', 'g'))
    FOR UPDATE;
  IF inviter IS NULL THEN RETURN 'invalid'; END IF;
  IF inviter = uid THEN RETURN 'self'; END IF;
  IF EXISTS (SELECT 1 FROM public.invites WHERE invitee_id = uid) THEN RETURN 'already'; END IF;
  IF joined < now() - interval '7 days' THEN RETURN 'too_old'; END IF;
  -- Not back to the one who invited you
  IF EXISTS (SELECT 1 FROM public.invites WHERE invitee_id = inviter AND inviter_id = uid) THEN RETURN 'self'; END IF;

  BEGIN
    INSERT INTO public.invites (invitee_id, inviter_id, rewarded) VALUES (uid, inviter, earned < 8);
  EXCEPTION WHEN unique_violation THEN
    RETURN 'already';
  END;

  IF earned < 8 THEN
    UPDATE public.invite_codes
      SET rewarded = rewarded + 1,
          pro_until = greatest(coalesce(pro_until, now()), now()) + interval '7 days'
      WHERE user_id = inviter
      RETURNING pro_until INTO until;
    -- What the archive's rules and the push sender read at once. checked_at is left as it was
    -- (or old, for a new row), so the next check also asks Stripe and Apple.
    INSERT INTO public.pro_status (user_id, pro_until, checked_at)
      VALUES (inviter, until, 'epoch')
      ON CONFLICT (user_id) DO UPDATE SET pro_until = greatest(public.pro_status.pro_until, EXCLUDED.pro_until);
  END IF;
  RETURN 'ok';
END;
$$;

-- The name of whoever's code this is, for the invite page ("Anna bjöd in dig"); null when the
-- code doesn't exist. Only the name people already show with their comments.
CREATE OR REPLACE FUNCTION public.invite_from(_code text)
RETURNS TABLE (valid boolean, inviter_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT true, nullif(btrim(p.display_name), '')
  FROM public.invite_codes i
  LEFT JOIN public.profiles p ON p.id = i.user_id
  WHERE i.code = upper(regexp_replace(coalesce(_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

REVOKE ALL ON FUNCTION public.my_invite() FROM public;
REVOKE ALL ON FUNCTION public.redeem_invite(text) FROM public;
REVOKE ALL ON FUNCTION public.invite_from(text) FROM public;
GRANT EXECUTE ON FUNCTION public.my_invite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_from(text) TO anon, authenticated;

-- Pro from Stripe (pro_status), Apple or invites. Same signature, so every policy that uses it
-- counts Pro from invites too.
CREATE OR REPLACE FUNCTION public.has_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.pro_status WHERE user_id = _user_id AND pro_until > now())
      OR EXISTS (SELECT 1 FROM public.apple_subscriptions WHERE user_id = _user_id AND expires_at > now())
      OR EXISTS (SELECT 1 FROM public.invite_codes WHERE user_id = _user_id AND pro_until > now())
$$;
REVOKE ALL ON FUNCTION public.has_pro(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.has_pro(uuid) TO authenticated, service_role;
