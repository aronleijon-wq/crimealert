CREATE TABLE IF NOT EXISTS public.sent_push_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  user_id uuid NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sent_push_log_event_user ON public.sent_push_log (event_id, user_id);
CREATE INDEX idx_sent_push_log_sent_at ON public.sent_push_log (sent_at);

ALTER TABLE public.sent_push_log ENABLE ROW LEVEL SECURITY;