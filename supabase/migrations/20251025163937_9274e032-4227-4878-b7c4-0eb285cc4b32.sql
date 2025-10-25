-- Create table for storing YouTube channels
CREATE TABLE public.youtube_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL,
  channel_thumbnail TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.youtube_channels ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no auth required for this app)
CREATE POLICY "Anyone can view channels" 
ON public.youtube_channels 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can add channels" 
ON public.youtube_channels 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can delete channels" 
ON public.youtube_channels 
FOR DELETE 
USING (true);