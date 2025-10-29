-- Add category column to youtube_channels table
ALTER TABLE public.youtube_channels
ADD COLUMN category TEXT;

-- Create index for faster category queries
CREATE INDEX idx_youtube_channels_category ON public.youtube_channels(category);