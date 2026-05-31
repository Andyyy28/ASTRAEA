-- Fix admin permissions for existing Astraea Supabase projects.
-- Run this in the Supabase SQL Editor if the admin panel can log in but
-- saving bouquets fails with "permission denied for table bouquets".

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.admin_users (user_id)
SELECT id
FROM auth.users
WHERE lower(email) = lower('admin_ako@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.bouquets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bouquets TO authenticated;
GRANT SELECT ON public.admin_users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO service_role;

ALTER TABLE public.bouquets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS bouquets_public_read ON public.bouquets;
CREATE POLICY bouquets_public_read ON public.bouquets
FOR SELECT TO anon, authenticated
USING (is_visible OR public.is_admin());

DROP POLICY IF EXISTS bouquets_admin_manage ON public.bouquets;
CREATE POLICY bouquets_admin_manage ON public.bouquets
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS admin_users_self_read ON public.admin_users;
CREATE POLICY admin_users_self_read ON public.admin_users
FOR SELECT TO authenticated
USING (user_id = auth.uid());

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
