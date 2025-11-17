-- Add daily video goal column to youtube_channels table
ALTER TABLE public.youtube_channels 
ADD COLUMN daily_video_goal INTEGER DEFAULT 1 CHECK (daily_video_goal > 0);