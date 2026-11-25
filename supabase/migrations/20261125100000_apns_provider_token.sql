-- The signed token send-push-notifications sends to Apple (APNs), kept between runs: Apple
-- refuses a token that changes more often than every 20 minutes (TooManyProviderTokenUpdates),
-- and every new signature is a new token. Only the service role reads or writes it.
CREATE TABLE IF NOT EXISTS public.apns_provider_token (
  key_id text PRIMARY KEY,
  issued_at bigint NOT NULL,
  token text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.apns_provider_token ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.apns_provider_token FROM anon, authenticated;
GRANT ALL ON public.apns_provider_token TO service_role;
