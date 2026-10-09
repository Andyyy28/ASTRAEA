-- Phase 4: non-destructive rollout hardening.
-- Apply only after the historical chain, Phase 2, and Phase 3 migrations.
-- This migration never drops tables, resets data, or rewrites historical SQL.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fail closed when an upgrade is attempted out of order. The checks use the
-- live catalog so a renamed or partially-created object cannot be mistaken for
-- a successful migration.
DO $$
DECLARE
  v_missing TEXT[];
BEGIN
  SELECT array_agg(object_name ORDER BY object_name)
    INTO v_missing
  FROM (
    VALUES
      ('public.orders', to_regclass('public.orders')),
      ('public.order_items', to_regclass('public.order_items')),
      ('public.bouquets', to_regclass('public.bouquets')),
      ('public.other_products', to_regclass('public.other_products')),
      ('public.flowers', to_regclass('public.flowers')),
      ('public.fillers', to_regclass('public.fillers')),
      ('public.checkout_sessions', to_regclass('public.checkout_sessions')),
      ('public.inventory_movements', to_regclass('public.inventory_movements')),
      ('public.inventory_reconciliation', to_regclass('public.inventory_reconciliation')),
      ('public.notification_events', to_regclass('public.notification_events')),
      ('public.admin_users', to_regclass('public.admin_users')),
      ('storage.objects', to_regclass('storage.objects')),
      ('storage.buckets', to_regclass('storage.buckets'))
  ) AS required(object_name, relation_name)
  WHERE relation_name IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 4 preflight failed; missing required relations: %', array_to_string(v_missing, ', ');
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.is_admin()') IS NULL THEN
    RAISE EXCEPTION 'Phase 4 preflight failed; public.is_admin() is missing';
  END IF;
END $$;

DO $$
DECLARE
  v_missing TEXT[];
BEGIN
  SELECT array_agg(format('%s.%s', table_name, column_name) ORDER BY table_name, column_name)
    INTO v_missing
  FROM (
    VALUES
      ('checkout_sessions', 'quote_token_hash'),
      ('checkout_sessions', 'quote_snapshot'),
      ('checkout_sessions', 'quote_created_at'),
      ('checkout_sessions', 'quote_expires_at'),
      ('orders', 'checkout_request_uuid'),
      ('orders', 'checkout_request_hash'),
      ('orders', 'checkout_session_id'),
      ('orders', 'quote_expires_at'),
      ('inventory_movements', 'order_id'),
      ('inventory_movements', 'order_item_id'),
      ('inventory_movements', 'reversed_at'),
      ('notification_events', 'event_type'),
      ('notification_events', 'entity_id'),
      ('notification_events', 'attempts'),
      ('notification_events', 'available_at')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = required.table_name
      AND c.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 4 preflight failed; missing required columns: %', array_to_string(v_missing, ', ');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-proofs') THEN
    RAISE EXCEPTION 'Phase 4 preflight failed; payment-proofs bucket is missing';
  END IF;
END $$;

-- No browser role may write any storage object. Catalog writes remain
-- available to authenticated administrators through their is_admin policy;
-- this also catches broad policies whose expression does not name a bucket.
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND EXISTS (
        SELECT 1 FROM unnest(roles) AS role_name
        WHERE role_name IN ('public', 'anon')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
  END LOOP;
END $$;

-- Authenticated storage writes must also carry the current admin predicate;
-- this repairs older catalog policies that granted a bucket without checking
-- membership in public.admin_users.
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND EXISTS (
        SELECT 1 FROM unnest(roles) AS role_name
        WHERE role_name = 'authenticated'
      )
      AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) NOT ILIKE '%is_admin%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
  END LOOP;
END $$;

-- Inspect actual live policies instead of assuming the names from the original
-- migrations. Anonymous/public write policies bypass the Edge API validation,
-- so remove only those policy definitions. Existing rows are untouched.
DO $$
DECLARE
  v_policy RECORD;
  v_removed INTEGER := 0;
BEGIN
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('orders', 'order_items', 'reviews')
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND EXISTS (
        SELECT 1
        FROM unnest(roles) AS role_name
        WHERE role_name IN ('public', 'anon')
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', v_policy.policyname, v_policy.schemaname, v_policy.tablename);
    v_removed := v_removed + 1;
  END LOOP;
  RAISE NOTICE 'Removed % anonymous/public customer-write policies during preflight', v_removed;
END $$;

-- Payment proofs must be server-uploaded and admin-viewed. Remove any live
-- policy that grants proof writes, public/anonymous reads, or a non-admin
-- authenticated read, regardless of its original policy name.
DO $$
DECLARE
  v_policy RECORD;
  v_is_public BOOLEAN;
  v_is_service BOOLEAN;
  v_is_admin_authenticated BOOLEAN;
BEGIN
  FOR v_policy IN
    SELECT policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        coalesce(qual, '') ILIKE '%payment-proofs%'
        OR coalesce(with_check, '') ILIKE '%payment-proofs%'
      )
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM unnest(v_policy.roles) AS role_name
      WHERE role_name IN ('public', 'anon')
    ) INTO v_is_public;
    SELECT EXISTS (
      SELECT 1 FROM unnest(v_policy.roles) AS role_name
      WHERE role_name = 'service_role'
    ) INTO v_is_service;
    SELECT EXISTS (
      SELECT 1 FROM unnest(v_policy.roles) AS role_name
      WHERE role_name = 'authenticated'
    ) AND coalesce(v_policy.qual, '') ILIKE '%is_admin%'
      INTO v_is_admin_authenticated;

    IF v_policy.cmd <> 'SELECT'
       OR v_is_public
       OR (NOT v_is_service AND NOT v_is_admin_authenticated) THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
    END IF;
  END LOOP;
END $$;

UPDATE storage.buckets
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
WHERE id = 'payment-proofs';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Admin view payment proofs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Admin view payment proofs"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'payment-proofs' AND public.is_admin())
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('orders', 'order_items', 'reviews')
      AND cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      AND EXISTS (
        SELECT 1 FROM unnest(roles) AS role_name
        WHERE role_name IN ('public', 'anon')
      )
  ) THEN
    RAISE EXCEPTION 'Phase 4 policy preflight failed; anonymous/public customer writes remain';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        (
          cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
          AND EXISTS (
            SELECT 1 FROM unnest(roles) AS role_name
            WHERE role_name IN ('public', 'anon')
          )
        )
        OR (
          cmd IN ('ALL', 'INSERT', 'UPDATE', 'DELETE')
          AND EXISTS (
            SELECT 1 FROM unnest(roles) AS role_name
            WHERE role_name = 'authenticated'
          )
          AND (coalesce(qual, '') || ' ' || coalesce(with_check, '')) NOT ILIKE '%is_admin%'
        )
        OR (
          cmd = 'SELECT'
          AND coalesce(qual, '') ILIKE '%payment-proofs%'
          AND EXISTS (
            SELECT 1 FROM unnest(roles) AS role_name
            WHERE role_name IN ('public', 'anon')
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Phase 4 policy preflight failed; payment proofs remain browser-readable or writable';
  END IF;
END $$;

-- Reject malformed pre-existing values before adding the corresponding checks.
-- A failed migration leaves all data and schema changes from this transaction
-- rolled back for the operator to reconcile safely.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.checkout_sessions
    WHERE quote_token_hash IS NOT NULL
      AND quote_token_hash !~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'Phase 4 preflight failed; checkout_sessions contains malformed quote token hashes';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.checkout_sessions
    WHERE quote_created_at IS NOT NULL
      AND quote_expires_at IS NOT NULL
      AND quote_expires_at <= quote_created_at
  ) THEN
    RAISE EXCEPTION 'Phase 4 preflight failed; checkout quote expiry precedes quote creation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.orders
    WHERE checkout_request_hash IS NOT NULL
      AND checkout_request_hash !~ '^[0-9a-f]{64}$'
  ) THEN
    RAISE EXCEPTION 'Phase 4 preflight failed; orders contains malformed checkout request hashes';
  END IF;
  IF EXISTS (SELECT 1 FROM public.notification_events WHERE attempts < 0) THEN
    RAISE EXCEPTION 'Phase 4 preflight failed; notification event attempts cannot be negative';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.checkout_sessions'::regclass
      AND conname = 'checkout_sessions_quote_token_hash_format'
  ) THEN
    ALTER TABLE public.checkout_sessions
      ADD CONSTRAINT checkout_sessions_quote_token_hash_format
      CHECK (quote_token_hash IS NULL OR quote_token_hash ~ '^[0-9a-f]{64}$') NOT VALID;
    ALTER TABLE public.checkout_sessions
      VALIDATE CONSTRAINT checkout_sessions_quote_token_hash_format;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.checkout_sessions'::regclass
      AND conname = 'checkout_sessions_quote_expiry_after_creation'
  ) THEN
    ALTER TABLE public.checkout_sessions
      ADD CONSTRAINT checkout_sessions_quote_expiry_after_creation
      CHECK (quote_created_at IS NULL OR quote_expires_at IS NULL OR quote_expires_at > quote_created_at) NOT VALID;
    ALTER TABLE public.checkout_sessions
      VALIDATE CONSTRAINT checkout_sessions_quote_expiry_after_creation;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND conname = 'orders_checkout_request_hash_format'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_checkout_request_hash_format
      CHECK (checkout_request_hash IS NULL OR checkout_request_hash ~ '^[0-9a-f]{64}$') NOT VALID;
    ALTER TABLE public.orders
      VALIDATE CONSTRAINT orders_checkout_request_hash_format;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.notification_events'::regclass
      AND conname = 'notification_events_attempts_nonnegative'
  ) THEN
    ALTER TABLE public.notification_events
      ADD CONSTRAINT notification_events_attempts_nonnegative
      CHECK (attempts >= 0) NOT VALID;
    ALTER TABLE public.notification_events
      VALIDATE CONSTRAINT notification_events_attempts_nonnegative;
  END IF;
END $$;

-- Indexes support expiry cleanup, idempotency, cancellation, and outbox
-- claiming without changing existing data or historical prices.
CREATE INDEX IF NOT EXISTS checkout_sessions_order_idx
  ON public.checkout_sessions (order_id)
  WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS checkout_sessions_quote_expiry_idx
  ON public.checkout_sessions (quote_expires_at)
  WHERE used_at IS NULL AND quote_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_checkout_session_idx
  ON public.orders (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_movements_order_item_idx
  ON public.inventory_movements (order_item_id)
  WHERE order_item_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_movements_unreversed_idx
  ON public.inventory_movements (order_id, product_type, product_id)
  WHERE movement_type = 'deduction' AND reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS inventory_reconciliation_open_idx
  ON public.inventory_reconciliation (created_at)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS notification_events_entity_idx
  ON public.notification_events (entity_id, event_type);

-- Realtime is limited to the customer/admin order views. Internal checkout,
-- inventory, and notification tables are deliberately not published.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE EXCEPTION 'Phase 4 preflight failed; supabase_realtime publication is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'order_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
  END IF;
END $$;

-- Customer mutations and internal workers are server-only. This loops over
-- the live function catalog so overloads are handled and stale compatibility
-- grants cannot silently survive a cutover.
DO $$
DECLARE
  v_function RECORD;
  v_server_only CONSTANT TEXT[] := ARRAY[
    'consume_api_rate_limit', 'claim_checkout_session',
    'complete_checkout_session', 'release_checkout_session',
    'create_checkout_quote', 'commit_checkout',
    'claim_notification_events', 'complete_notification_event',
    'retry_notification_event', 'create_guest_stock_reservation',
    'release_guest_stock_reservation', 'bind_guest_stock_reservations',
    'unbind_guest_stock_reservations', 'finalize_guest_stock_reservations',
    'release_expired_guest_stock_reservations', 'place_order',
    'calculate_custom_subtotal', 'track_order', 'reserve_bouquet_stock',
    'release_bouquet_stock'
  ];
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(v_server_only)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_function.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_function.signature);
  END LOOP;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reviews FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.checkout_sessions, public.inventory_movements,
  public.inventory_reconciliation, public.notification_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checkout_sessions,
  public.inventory_movements, public.inventory_reconciliation,
  public.notification_events TO service_role;
GRANT SELECT ON public.orders, public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders, public.order_items,
  public.reviews TO service_role;

NOTIFY pgrst, 'reload schema';
