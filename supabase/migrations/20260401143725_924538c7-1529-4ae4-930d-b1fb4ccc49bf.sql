
-- Add file columns to messages
ALTER TABLE public.messages ADD COLUMN file_url text;
ALTER TABLE public.messages ADD COLUMN file_type text;
ALTER TABLE public.messages ADD COLUMN file_name text;

-- Create message-files storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-files', 'message-files', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for message-files bucket: authenticated users can upload
CREATE POLICY "Authenticated users can upload message files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'message-files');

-- Anyone can view message files
CREATE POLICY "Anyone can view message files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'message-files');

-- Users can delete their own uploads
CREATE POLICY "Users can delete own message files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'message-files' AND (storage.foldername(name))[1] = auth.uid()::text);
