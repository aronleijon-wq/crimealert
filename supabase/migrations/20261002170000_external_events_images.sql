-- The source's own image for an event (only stored for sources allowed in the NEWS_IMAGES secret)
-- and the photographer or rights holder to credit with it
ALTER TABLE public.external_events
  ADD COLUMN IF NOT EXISTS image_url text CHECK (image_url IS NULL OR image_url ~ '^https://'),
  ADD COLUMN IF NOT EXISTS image_credit text;
