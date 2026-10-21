-- Pro bought in the iPhone app, through Apple (functions apple-subscription and
-- apple-notifications, which only store what Apple's own servers answer). One row per
-- subscription; it gives its account Pro until expires_at. Only the service role writes here.
CREATE TABLE IF NOT EXISTS public.apple_subscriptions (
  original_transaction_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  -- Pro until then; null when Apple says it gives no Pro (expired, refunded, payment failed)
  expires_at timestamptz,
  environment text NOT NULL CHECK (environment IN ('production', 'sandbox')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS apple_subscriptions_user_idx ON public.apple_subscriptions (user_id);

ALTER TABLE public.apple_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own Apple subscriptions" ON public.apple_subscriptions;
CREATE POLICY "Users can view own Apple subscriptions" ON public.apple_subscriptions
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
GRANT SELECT ON public.apple_subscriptions TO authenticated;
GRANT ALL ON public.apple_subscriptions TO service_role;

-- Pro from Stripe (pro_status) or from Apple. Same signature, so every policy that uses it
-- (the archive, citizen reports) counts Pro bought in the app.
CREATE OR REPLACE FUNCTION public.has_pro(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.pro_status WHERE user_id = _user_id AND pro_until > now())
      OR EXISTS (SELECT 1 FROM public.apple_subscriptions WHERE user_id = _user_id AND expires_at > now())
$$;
REVOKE ALL ON FUNCTION public.has_pro(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.has_pro(uuid) TO authenticated, service_role;