
-- Table for manually added video links (Watch Later)
CREATE TABLE public.watchlist_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  video_url TEXT NOT NULL,
  duration_seconds INTEGER DEFAULT 0,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.watchlist_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watchlist"
ON public.watchlist_videos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watchlist"
ON public.watchlist_videos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watchlist"
ON public.watchlist_videos FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlist"
ON public.watchlist_videos FOR UPDATE
USING (auth.uid() = user_id);
