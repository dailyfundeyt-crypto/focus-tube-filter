
CREATE TABLE public.saved_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own links" ON public.saved_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own links" ON public.saved_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own links" ON public.saved_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own links" ON public.saved_links FOR DELETE USING (auth.uid() = user_id);
