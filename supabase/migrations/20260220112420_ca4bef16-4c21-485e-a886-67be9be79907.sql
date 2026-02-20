
CREATE TABLE public.reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  message TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Anonym',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reviews"
ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert their own review"
ON public.reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own review"
ON public.reviews FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own review"
ON public.reviews FOR DELETE
USING (auth.uid() = user_id);
