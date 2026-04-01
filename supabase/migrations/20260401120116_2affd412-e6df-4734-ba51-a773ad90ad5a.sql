
CREATE TABLE public.posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  post_type TEXT NOT NULL,
  category TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '익명',
  venue TEXT,
  pay TEXT,
  price TEXT,
  area TEXT,
  hours TEXT,
  instruments TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read posts" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Logged in users can create posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
