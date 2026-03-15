
CREATE TABLE public.police_events_archive (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  area TEXT,
  time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active',
  risk TEXT DEFAULT 'low',
  source TEXT DEFAULT 'Polisen.se',
  original_type TEXT,
  url TEXT,
  location_precision TEXT DEFAULT 'area',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for time-based queries (30-day lookback)
CREATE INDEX idx_police_events_archive_time ON public.police_events_archive (time DESC);

-- RLS: public read access (no auth needed for viewing)
ALTER TABLE public.police_events_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read police events archive"
ON public.police_events_archive
FOR SELECT
TO public
USING (true);

-- Auto-cleanup: delete events older than 35 days via a trigger on insert
CREATE OR REPLACE FUNCTION public.cleanup_old_police_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.police_events_archive WHERE time < NOW() - INTERVAL '35 days';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_old_police_events
AFTER INSERT ON public.police_events_archive
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_old_police_events();
