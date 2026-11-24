ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS all_sweden boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS kommun_chat boolean NOT NULL DEFAULT false;
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS nearby_reports boolean NOT NULL DEFAULT true;