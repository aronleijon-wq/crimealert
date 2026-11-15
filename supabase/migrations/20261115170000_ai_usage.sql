-- What each answer from Fråga CrimeAlert used, to show the AI's cost in the admin dashboard.
-- One row per answer: the model that answered and its tokens over all tool rounds. No user id
-- and no text, and kept (unlike ask_log, which only counts today's questions).
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cache_read_tokens integer NOT NULL DEFAULT 0,
  cache_write_tokens integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON public.ai_usage (created_at);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ai_usage TO service_role;
