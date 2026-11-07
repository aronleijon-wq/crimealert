-- Who has been added to the newsletter list in Resend (_shared/newsletter.ts), so Resend is asked
-- once per account. Only the service role reads or writes it.
CREATE TABLE IF NOT EXISTS public.newsletter_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  synced_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newsletter_contacts ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.newsletter_contacts TO service_role;
