-- Places CrimeAlert has learned from Polisen's texts: streets, crossings, roads and areas, per
-- kommun, with where the geocoder put them (checked to lie in that kommun). police-events looks
-- here before asking the geocoder, so a name is looked up once and then known, and a name that
-- couldn't be found in the kommun (lat null) isn't asked about again. Only the service role
-- reads and writes it.
CREATE TABLE IF NOT EXISTS public.place_names (
  key text PRIMARY KEY,            -- "<kommun>|<name>", lower case
  kommun text NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('crossing', 'street', 'road', 'area')),
  lat double precision,            -- null: not found in the kommun
  lng double precision,
  hits integer NOT NULL DEFAULT 1, -- how many events have named it
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS place_names_kommun_idx ON public.place_names (kommun);

ALTER TABLE public.place_names ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.place_names TO service_role;