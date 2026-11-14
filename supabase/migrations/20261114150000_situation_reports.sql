-- Lägesbild: the last written summary of each kommun's week (situation-report). Kept so it is
-- written at most every twelve hours per kommun, whoever asks. It says only what Polisen has
-- published, so anyone may read it; only the edge function (service role) writes.

CREATE TABLE IF NOT EXISTS public.situation_reports (
  kommun text PRIMARY KEY,
  summary text NOT NULL CHECK (char_length(summary) <= 1000),
  this_week integer NOT NULL DEFAULT 0,
  last_week integer NOT NULL DEFAULT 0,
  -- The model that wrote it, or null when it is the plain count
  model text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.situation_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read situation reports" ON public.situation_reports;
CREATE POLICY "Anyone can read situation reports" ON public.situation_reports
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.situation_reports TO anon, authenticated;
GRANT ALL ON public.situation_reports TO service_role;
