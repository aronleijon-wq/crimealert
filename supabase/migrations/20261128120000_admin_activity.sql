-- Who uses CrimeAlert, for the admin dashboard's command centre (admin-dashboard): accounts with a
-- session in use the last day, week and month (DAU/WAU/MAU), and how many came back 7 and 30
-- days after they joined. A signed-in session is refreshed while the site or the app is open, so
-- its updated_at is the last use. Sessions that ended (signed out, expired) are gone, so the
-- numbers are the least it can be. Only the service role (admin-dashboard) may call it.
CREATE OR REPLACE FUNCTION public.admin_activity()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  WITH last_use AS (
    SELECT s.user_id, max(s.updated_at) AS used_at
    FROM auth.sessions s
    GROUP BY s.user_id
  ),
  d7 AS (
    SELECT u.id, EXISTS (
      SELECT 1 FROM auth.sessions s WHERE s.user_id = u.id AND s.updated_at >= u.created_at + interval '7 days'
    ) AS back
    FROM auth.users u
    WHERE u.created_at BETWEEN now() - interval '37 days' AND now() - interval '7 days'
  ),
  d30 AS (
    SELECT u.id, EXISTS (
      SELECT 1 FROM auth.sessions s WHERE s.user_id = u.id AND s.updated_at >= u.created_at + interval '30 days'
    ) AS back
    FROM auth.users u
    WHERE u.created_at BETWEEN now() - interval '90 days' AND now() - interval '30 days'
  )
  SELECT jsonb_build_object(
    'dau', (SELECT count(*) FROM last_use WHERE used_at > now() - interval '1 day'),
    'wau', (SELECT count(*) FROM last_use WHERE used_at > now() - interval '7 days'),
    'mau', (SELECT count(*) FROM last_use WHERE used_at > now() - interval '30 days'),
    'd7', jsonb_build_object('cohort', (SELECT count(*) FROM d7), 'back', (SELECT count(*) FROM d7 WHERE back)),
    'd30', jsonb_build_object('cohort', (SELECT count(*) FROM d30), 'back', (SELECT count(*) FROM d30 WHERE back))
  );
$$;
REVOKE ALL ON FUNCTION public.admin_activity() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_activity() TO service_role;
