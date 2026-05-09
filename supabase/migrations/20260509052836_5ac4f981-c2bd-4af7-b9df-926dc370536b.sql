CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  user_id UUID NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'applied',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (job_id, user_id)
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read applications"
ON public.job_applications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create own applications"
ON public.job_applications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own applications"
ON public.job_applications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_job_applications_job ON public.job_applications(job_id);
CREATE INDEX idx_job_applications_user ON public.job_applications(user_id);