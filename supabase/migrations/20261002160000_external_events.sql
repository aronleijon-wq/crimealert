-- Events from sources other than Polisen.se: Trafikverket, Krisinformation.se, VMA (Sveriges Radio)
-- and news headlines. Written only by the ingest-sources edge function (service role).
CREATE TABLE public.external_events (
  id text PRIMARY KEY,
  source text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('vma', 'crisis', 'traffic', 'news')),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  url text CHECK (url IS NULL OR url ~ '^https?://'),
  area text,
  lat double precision,
  lng double precision,
  published_at timestamptz NOT NULL,
  ends_at timestamptz,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high')),
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX external_events_published_at_idx ON public.external_events (published_at DESC);
CREATE INDEX external_events_kind_published_at_idx ON public.external_events (kind, published_at DESC);

ALTER TABLE public.external_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read external events" ON public.external_events
  FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.external_events TO anon, authenticated;
GRANT ALL ON public.external_events TO service_role;

-- When ingest-sources last ran, so overlapping or extra calls skip instead of repeating the work
CREATE TABLE public.ingest_state (
  key text PRIMARY KEY,
  last_run_at timestamptz NOT NULL DEFAULT 'epoch'
);
ALTER TABLE public.ingest_state ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.ingest_state TO service_role;
INSERT INTO public.ingest_state (key) VALUES ('sources') ON CONFLICT DO NOTHING;
