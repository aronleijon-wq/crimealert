-- Wider notification choices (Notiser page): Polisen's events in all of Sweden, new posts in the
-- discussions of your kommuner, and reports from people on the spot near you (_shared/notifyExtras).
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS all_sweden boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS kommun_chat boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS nearby_reports boolean NOT NULL DEFAULT true;
