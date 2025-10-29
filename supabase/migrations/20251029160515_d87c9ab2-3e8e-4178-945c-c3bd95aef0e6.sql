-- First, delete all existing channel data (they will need to be re-added by authenticated users)
DELETE FROM public.cached_videos;
DELETE FROM public.youtube_channels;

-- Add user_id column to youtube_channels table
ALTER TABLE public.youtube_channels 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL;

-- Drop existing insecure policies
DROP POLICY IF EXISTS "Anyone can add channels" ON public.youtube_channels;
DROP POLICY IF EXISTS "Anyone can delete channels" ON public.youtube_channels;
DROP POLICY IF EXISTS "Anyone can view channels" ON public.youtube_channels;

-- Create secure RLS policies for authenticated users only
CREATE POLICY "Users can insert their own channels" 
ON public.youtube_channels 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own channels" 
ON public.youtube_channels 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own channels" 
ON public.youtube_channels 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);