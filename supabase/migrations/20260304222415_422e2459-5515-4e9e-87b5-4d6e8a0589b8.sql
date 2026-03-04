
-- Community safety reports table
CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  lat double precision,
  lng double precision,
  area text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can read reports
CREATE POLICY "Anyone can read community reports"
  ON public.community_reports FOR SELECT
  USING (true);

-- Authenticated users can insert their own reports
CREATE POLICY "Users can insert own reports"
  ON public.community_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reports
CREATE POLICY "Users can delete own reports"
  ON public.community_reports FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
