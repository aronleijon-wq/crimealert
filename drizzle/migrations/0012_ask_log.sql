CREATE TABLE IF NOT EXISTS public.ask_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ask_log_user_day_idx ON public.ask_log (user_id, created_at);

ALTER TABLE public.ask_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ask_log TO service_role;