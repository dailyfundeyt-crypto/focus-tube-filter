-- Add UPDATE policy for youtube_channels table
CREATE POLICY "Users can update their own channels" 
ON public.youtube_channels 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);