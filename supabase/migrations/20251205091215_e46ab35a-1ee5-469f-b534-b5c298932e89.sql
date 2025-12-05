-- Create folders table for organizing channels
CREATE TABLE public.channel_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  folder_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add folder_id to youtube_channels
ALTER TABLE public.youtube_channels ADD COLUMN folder_id UUID REFERENCES public.channel_folders(id) ON DELETE SET NULL;

-- Enable RLS on folders
ALTER TABLE public.channel_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for folders
CREATE POLICY "Users can view their own folders" 
ON public.channel_folders FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders" 
ON public.channel_folders FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders" 
ON public.channel_folders FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders" 
ON public.channel_folders FOR DELETE 
USING (auth.uid() = user_id);