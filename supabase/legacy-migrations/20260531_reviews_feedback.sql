-- Customer reviews and admin feedback moderation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    is_displayed BOOLEAN DEFAULT false,
    admin_reply TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'customer_name'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND column_name = 'name'
  ) THEN
    ALTER TABLE public.reviews RENAME COLUMN customer_name TO name;
  END IF;
END $$;

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_displayed BOOLEAN DEFAULT false;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS admin_reply TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

UPDATE public.reviews SET name = 'Anonymous' WHERE name IS NULL OR trim(name) = '';
UPDATE public.reviews SET message = '' WHERE message IS NULL;
UPDATE public.reviews SET is_displayed = false WHERE is_displayed IS NULL;

ALTER TABLE public.reviews ALTER COLUMN name SET NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN message SET NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN is_displayed SET DEFAULT false;
ALTER TABLE public.reviews ALTER COLUMN created_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reviews_rating_between_1_and_5'
      AND conrelid = 'public.reviews'::regclass
  ) THEN
    ALTER TABLE public.reviews
    ADD CONSTRAINT reviews_rating_between_1_and_5 CHECK (rating BETWEEN 1 AND 5);
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON public.reviews TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_public_read ON public.reviews;
CREATE POLICY reviews_public_read ON public.reviews
FOR SELECT TO anon, authenticated
USING (is_displayed = true OR public.is_admin());

DROP POLICY IF EXISTS reviews_customer_insert ON public.reviews;
CREATE POLICY reviews_customer_insert ON public.reviews
FOR INSERT TO anon, authenticated
WITH CHECK (
  trim(name) <> ''
  AND trim(message) <> ''
  AND rating BETWEEN 1 AND 5
  AND COALESCE(is_displayed, false) = false
  AND admin_reply IS NULL
);

DROP POLICY IF EXISTS reviews_admin_manage ON public.reviews;
CREATE POLICY reviews_admin_manage ON public.reviews
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
