-- Phase 2 customer API and payment-proof hardening.
-- This migration is additive and does not change inventory or place_order bodies.
-- Apply after all existing migrations in a staging database first.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.checkout_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash TEXT NOT NULL UNIQUE,
    client_hash TEXT NOT NULL,
    turnstile_verified_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL,
    claimed_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    proof_path TEXT,
    proof_content_type TEXT,
    proof_size BIGINT,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    CONSTRAINT checkout_sessions_expiry_after_creation CHECK (expires_at > created_at),
    CONSTRAINT checkout_sessions_proof_type CHECK (proof_content_type IS NULL OR proof_content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT checkout_sessions_proof_size CHECK (proof_size IS NULL OR (proof_size > 0 AND proof_size <= 5242880)),
    CONSTRAINT checkout_sessions_proof_path CHECK (proof_path IS NULL OR proof_path ~ '^payment-proofs/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$')
);

CREATE INDEX IF NOT EXISTS checkout_sessions_expiry_idx
    ON public.checkout_sessions (expires_at)
    WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
    key_hash TEXT NOT NULL,
    action TEXT NOT NULL,
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (key_hash, action)
);

CREATE INDEX IF NOT EXISTS api_rate_limits_expiry_idx
    ON public.api_rate_limits (expires_at);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.checkout_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.api_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkout_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_api_rate_limit(
    p_key_hash TEXT,
    p_action TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_allowed BOOLEAN;
BEGIN
    IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$'
       OR p_action IS NULL OR length(p_action) > 40
       OR p_limit < 1 OR p_limit > 1000
       OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
        RAISE EXCEPTION 'Invalid rate-limit request';
    END IF;

    INSERT INTO public.api_rate_limits (key_hash, action, window_started_at, request_count, expires_at)
    VALUES (p_key_hash, p_action, timezone('utc'::text, now()), 1,
            timezone('utc'::text, now()) + (p_window_seconds * interval '1 second'))
    ON CONFLICT (key_hash, action) DO UPDATE
    SET window_started_at = CASE
            WHEN public.api_rate_limits.expires_at <= timezone('utc'::text, now())
            THEN timezone('utc'::text, now())
            ELSE public.api_rate_limits.window_started_at
        END,
        request_count = CASE
            WHEN public.api_rate_limits.expires_at <= timezone('utc'::text, now()) THEN 1
            ELSE public.api_rate_limits.request_count + 1
        END,
        expires_at = CASE
            WHEN public.api_rate_limits.expires_at <= timezone('utc'::text, now())
            THEN timezone('utc'::text, now()) + (p_window_seconds * interval '1 second')
            ELSE public.api_rate_limits.expires_at
        END
    RETURNING request_count <= p_limit INTO v_allowed;

    RETURN COALESCE(v_allowed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_checkout_session(p_session_id UUID, p_token_hash TEXT)
RETURNS public.checkout_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_session public.checkout_sessions%ROWTYPE;
BEGIN
    IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
        RETURN NULL;
    END IF;

    UPDATE public.checkout_sessions
    SET claimed_at = timezone('utc'::text, now())
    WHERE id = p_session_id
      AND token_hash = p_token_hash
      AND expires_at > timezone('utc'::text, now())
      AND used_at IS NULL
      AND (claimed_at IS NULL OR claimed_at < timezone('utc'::text, now()) - interval '5 minutes')
    RETURNING * INTO v_session;

    RETURN v_session;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_checkout_session(
    p_session_id UUID,
    p_token_hash TEXT,
    p_order_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE public.checkout_sessions
    SET used_at = timezone('utc'::text, now()), order_id = p_order_id
    WHERE id = p_session_id
      AND token_hash = p_token_hash
      AND used_at IS NULL
      AND claimed_at IS NOT NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_checkout_session(p_session_id UUID, p_token_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE public.checkout_sessions
    SET claimed_at = NULL
    WHERE id = p_session_id
      AND token_hash = p_token_hash
      AND used_at IS NULL;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_api_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_checkout_session(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_checkout_session(UUID, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_checkout_session(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_checkout_session(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_checkout_session(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_checkout_session(UUID, TEXT) TO service_role;

-- Cart reservations retain the existing stock routines but bind every release
-- to a random server-issued token. This prevents anonymous callers from
-- releasing arbitrary bouquet stock while keeping the current cart workflow.
CREATE TABLE IF NOT EXISTS public.guest_stock_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bouquet_id UUID NOT NULL REFERENCES public.bouquets(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    client_hash TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 0 AND quantity <= 50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()) + interval '30 minutes',
    checkout_session_id UUID REFERENCES public.checkout_sessions(id),
    released_at TIMESTAMPTZ,
    CONSTRAINT guest_stock_reservations_token_hash CHECK (token_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS guest_stock_reservations_expiry_idx
    ON public.guest_stock_reservations (expires_at)
    WHERE released_at IS NULL;

ALTER TABLE public.guest_stock_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guest_stock_reservations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.guest_stock_reservations TO service_role;

CREATE OR REPLACE FUNCTION public.create_guest_stock_reservation(
    p_bouquet_id UUID,
    p_quantity INTEGER,
    p_token_hash TEXT,
    p_client_hash TEXT
)
RETURNS TABLE(reservation_id UUID, stock INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_stock INTEGER;
    v_id UUID;
BEGIN
    IF p_bouquet_id IS NULL OR p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 50
       OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$'
       OR p_client_hash IS NULL OR p_client_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid stock reservation';
    END IF;

    SELECT public.reserve_bouquet_stock(p_bouquet_id, p_quantity) INTO v_stock;
    IF v_stock IS NULL THEN RETURN; END IF;

    INSERT INTO public.guest_stock_reservations (bouquet_id, token_hash, client_hash, quantity)
    VALUES (p_bouquet_id, p_token_hash, p_client_hash, p_quantity)
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, v_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_guest_stock_reservation(
    p_reservation_id UUID,
    p_token_hash TEXT,
    p_quantity INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_bouquet_id UUID;
    v_remaining INTEGER;
    v_stock INTEGER;
BEGIN
    IF p_reservation_id IS NULL OR p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 50
       OR p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid stock release';
    END IF;

    SELECT bouquet_id, quantity INTO v_bouquet_id, v_remaining
    FROM public.guest_stock_reservations
    WHERE id = p_reservation_id AND token_hash = p_token_hash AND released_at IS NULL
    FOR UPDATE;
    IF v_bouquet_id IS NULL OR p_quantity > v_remaining THEN RETURN NULL; END IF;

    UPDATE public.guest_stock_reservations
    SET quantity = quantity - p_quantity,
        released_at = CASE WHEN quantity = p_quantity THEN timezone('utc'::text, now()) ELSE NULL END
    WHERE id = p_reservation_id;

    SELECT public.release_bouquet_stock(v_bouquet_id, p_quantity) INTO v_stock;
    IF v_stock IS NULL THEN RAISE EXCEPTION 'Stock release failed'; END IF;
    RETURN v_stock;
END;
$$;

CREATE OR REPLACE FUNCTION public.bind_guest_stock_reservations(p_session_id UUID, p_reservations JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_reservation JSONB;
BEGIN
    IF jsonb_typeof(p_reservations) <> 'array' OR jsonb_array_length(p_reservations) > 100 THEN
        RAISE EXCEPTION 'Invalid reservation authorization';
    END IF;
    FOR v_reservation IN SELECT value FROM jsonb_array_elements(p_reservations)
    LOOP
        UPDATE public.guest_stock_reservations
        SET checkout_session_id = p_session_id
        WHERE id = (v_reservation->>'id')::UUID
          AND token_hash = v_reservation->>'token_hash'
          AND quantity = (v_reservation->>'quantity')::INTEGER
          AND bouquet_id = (v_reservation->>'bouquet_id')::UUID
          AND released_at IS NULL AND checkout_session_id IS NULL AND expires_at > timezone('utc'::text, now());
    END LOOP;
    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_expired_guest_stock_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_row RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_row IN
        SELECT id, token_hash, quantity
        FROM public.guest_stock_reservations
        WHERE released_at IS NULL AND expires_at <= timezone('utc'::text, now())
        FOR UPDATE SKIP LOCKED
    LOOP
        PERFORM public.release_guest_stock_reservation(v_row.id, v_row.token_hash, v_row.quantity);
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.unbind_guest_stock_reservations(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE public.guest_stock_reservations
    SET checkout_session_id = NULL
    WHERE checkout_session_id = p_session_id AND released_at IS NULL;
    SELECT true;
$$;

CREATE OR REPLACE FUNCTION public.finalize_guest_stock_reservations(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_row RECORD;
BEGIN
    FOR v_row IN
        SELECT id, token_hash, quantity
        FROM public.guest_stock_reservations
        WHERE checkout_session_id = p_session_id AND released_at IS NULL
        FOR UPDATE
    LOOP
        PERFORM public.release_guest_stock_reservation(v_row.id, v_row.token_hash, v_row.quantity);
    END LOOP;
    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.create_guest_stock_reservation(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_guest_stock_reservation(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bind_guest_stock_reservations(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unbind_guest_stock_reservations(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_guest_stock_reservations(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_expired_guest_stock_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_guest_stock_reservation(UUID, INTEGER, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_guest_stock_reservation(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.bind_guest_stock_reservations(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.unbind_guest_stock_reservations(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_guest_stock_reservations(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_expired_guest_stock_reservations() TO service_role;

-- Customer writes and stock mutations go through the validated Edge API.
REVOKE EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_custom_subtotal(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.track_order(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_bouquet_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_bouquet_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_custom_subtotal(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.track_order(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_bouquet_stock(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_bouquet_stock(UUID, INTEGER) TO service_role;

-- Direct public review insertion is removed; the Edge API uses service_role.
REVOKE INSERT ON public.reviews FROM anon, authenticated;
DROP POLICY IF EXISTS reviews_customer_insert ON public.reviews;
REVOKE ALL ON public.orders, public.order_items FROM anon;
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO service_role;

-- Payment proofs are private and bounded. Catalog buckets remain public for reads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-proofs', 'payment-proofs', false, 5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

DROP POLICY IF EXISTS "Guest upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Public view payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admin view payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admin upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admin update payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete payment proofs" ON storage.objects;

DO $$
DECLARE
    v_policy RECORD;
BEGIN
    FOR v_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND (coalesce(qual, '') ILIKE '%payment-proofs%' OR coalesce(with_check, '') ILIKE '%payment-proofs%')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
    END LOOP;
END $$;

CREATE POLICY "Admin view payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-proofs' AND public.is_admin());

-- Catalog objects are writable only by verified administrators.
DROP POLICY IF EXISTS "Admin can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload other product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update other product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete other product images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload addon images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update addon images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete addon images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update catalog images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete catalog images" ON storage.objects;

DO $$
DECLARE
    v_policy RECORD;
BEGIN
    FOR v_policy IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage' AND tablename = 'objects'
          AND upper(cmd) IN ('INSERT', 'UPDATE', 'DELETE')
          AND (
            coalesce(qual, '') ILIKE ANY (ARRAY['%bouquets%', '%images%', '%other-products%', '%addons%'])
            OR coalesce(with_check, '') ILIKE ANY (ARRAY['%bouquets%', '%images%', '%other-products%', '%addons%'])
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
    END LOOP;
END $$;

CREATE POLICY "Admin can upload catalog images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('bouquets', 'images', 'other-products', 'addons') AND public.is_admin());

CREATE POLICY "Admin can update catalog images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('bouquets', 'images', 'other-products', 'addons') AND public.is_admin())
WITH CHECK (bucket_id IN ('bouquets', 'images', 'other-products', 'addons') AND public.is_admin());

CREATE POLICY "Admin can delete catalog images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('bouquets', 'images', 'other-products', 'addons') AND public.is_admin());

DROP POLICY IF EXISTS "Public can view catalog images" ON storage.objects;
CREATE POLICY "Public can view catalog images"
ON storage.objects FOR SELECT TO public
USING (bucket_id IN ('bouquets', 'images', 'other-products', 'addons'));

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id IN ('bouquets', 'images', 'other-products', 'addons');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('bouquets', 'bouquets', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('images', 'images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('other-products', 'other-products', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]),
  ('addons', 'addons', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[];

NOTIFY pgrst, 'reload schema';
