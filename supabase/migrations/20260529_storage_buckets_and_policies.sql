-- Storage buckets and policies for Astraea bouquet images.
-- Run this in the Supabase SQL Editor for existing projects.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('bouquets', 'bouquets', true),
  ('images', 'images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Admin upload bouquet images" ON storage.objects;
DROP POLICY IF EXISTS "Admin manage bouquet images" ON storage.objects;
DROP POLICY IF EXISTS "Public view bouquet images" ON storage.objects;

DROP POLICY IF EXISTS "Admin can upload images" ON storage.objects;
CREATE POLICY "Admin can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bouquets');

DROP POLICY IF EXISTS "Admin can update images" ON storage.objects;
CREATE POLICY "Admin can update images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'bouquets')
WITH CHECK (bucket_id = 'bouquets');

DROP POLICY IF EXISTS "Admin can delete images" ON storage.objects;
CREATE POLICY "Admin can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'bouquets');

DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
CREATE POLICY "Public can view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bouquets');
