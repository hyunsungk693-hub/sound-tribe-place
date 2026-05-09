CREATE POLICY "Job owners can update applications"
ON public.job_applications
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = job_applications.job_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = job_applications.job_id AND p.user_id = auth.uid()));