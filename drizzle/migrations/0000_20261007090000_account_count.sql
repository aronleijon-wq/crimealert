-- How many have an account, for "Gå med över 500 användare" on Skapa konto. Counts confirmed
-- accounts that are not deleted, and gives only the whole hundreds below the count (742 → 700,
-- 800 → 700), so "över" is always true and the exact number stays private.
CREATE OR REPLACE FUNCTION public.account_count()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (greatest(count(*) - 1, 0) / 100 * 100)::int
  FROM auth.users
  WHERE email_confirmed_at IS NOT NULL
    AND deleted_at IS NULL
$$;
REVOKE ALL ON FUNCTION public.account_count() FROM public;
GRANT EXECUTE ON FUNCTION public.account_count() TO anon, authenticated;