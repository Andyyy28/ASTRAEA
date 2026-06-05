ALTER TABLE public.bouquet_addons
ADD COLUMN IF NOT EXISTS image_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('addons', 'addons', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Admin can upload addon images" ON storage.objects;
CREATE POLICY "Admin can upload addon images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'addons');

DROP POLICY IF EXISTS "Admin can update addon images" ON storage.objects;
CREATE POLICY "Admin can update addon images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'addons')
WITH CHECK (bucket_id = 'addons');

DROP POLICY IF EXISTS "Admin can delete addon images" ON storage.objects;
CREATE POLICY "Admin can delete addon images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'addons');

DROP POLICY IF EXISTS "Public can view addon images" ON storage.objects;
CREATE POLICY "Public can view addon images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'addons');

NOTIFY pgrst, 'reload schema';

