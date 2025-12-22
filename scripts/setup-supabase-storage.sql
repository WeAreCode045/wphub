-- Supabase Storage configuratie voor file uploads

-- Maak storage bucket aan voor uploads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true, -- Public bucket zodat geüploade bestanden publiek toegankelijk zijn
  10485760, -- 10MB limiet
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Policies voor storage bucket
-- Iedereen kan lezen
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'uploads');

-- Authenticated users kunnen uploaden
CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');

-- Users kunnen hun eigen uploads updaten
CREATE POLICY "Users can update own uploads" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users kunnen hun eigen uploads verwijderen
CREATE POLICY "Users can delete own uploads" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
