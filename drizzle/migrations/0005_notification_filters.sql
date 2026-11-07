-- More choice over notifications (_shared/notifications.ts): only some kinds of crime, quiet hours,
-- and a circle around a place besides the watched kommuner. All empty means as before.
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS themes text[],
  ADD COLUMN IF NOT EXISTS quiet_start smallint CHECK (quiet_start BETWEEN 0 AND 23),
  ADD COLUMN IF NOT EXISTS quiet_end smallint CHECK (quiet_end BETWEEN 0 AND 23),
  -- Kept to about a hundred metres; only for drawing the circle and finding events in it
  ADD COLUMN IF NOT EXISTS near_lat double precision CHECK (near_lat BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS near_lng double precision CHECK (near_lng BETWEEN -180 AND 180),
  ADD COLUMN IF NOT EXISTS near_radius_km real CHECK (near_radius_km > 0 AND near_radius_km <= 100);