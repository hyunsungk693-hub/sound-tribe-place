
-- Add image_url column to posts
ALTER TABLE public.posts ADD COLUMN image_url text NULL;

-- Create storage bucket for post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true);

-- Storage RLS policies
CREATE POLICY "Anyone can view post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');

CREATE POLICY "Authenticated users can upload post images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'post-images');

CREATE POLICY "Users can delete own post images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
