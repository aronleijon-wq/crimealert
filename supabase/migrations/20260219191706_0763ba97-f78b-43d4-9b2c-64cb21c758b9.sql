
-- Geocode cache: stores address → coordinates to avoid repeated Nominatim lookups
CREATE TABLE public.geocode_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  query TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  precision TEXT NOT NULL DEFAULT 'area',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(query)
);

-- Public read/write since edge functions use anon key
ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read geocode cache"
  ON public.geocode_cache FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert geocode cache"
  ON public.geocode_cache FOR INSERT
  WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX idx_geocode_cache_query ON public.geocode_cache (query);
