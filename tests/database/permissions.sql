-- Run with psql -v ON_ERROR_STOP=1 -f tests/database/permissions.sql
-- against an isolated, fully migrated Supabase database only.
-- This is a grant/RLS smoke test, not a substitute for the HTTP identity matrix.
BEGIN;
DO $$
DECLARE obj text; role_name text; fn regprocedure;
BEGIN
  FOREACH obj IN ARRAY ARRAY['orders','order_items','checkout_sessions','inventory_movements','reviews'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=obj AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'RLS missing on %', obj;
    END IF;
    IF has_table_privilege('anon', 'public.' || obj, 'INSERT,UPDATE,DELETE') THEN
      RAISE EXCEPTION 'Anonymous mutation grant on %', obj;
    END IF;
  END LOOP;
  FOREACH obj IN ARRAY ARRAY['bouquets','other_products','flowers','fillers'] LOOP
    IF has_column_privilege('authenticated', 'public.' || obj, 'stock', 'UPDATE') THEN
      RAISE EXCEPTION 'Direct stock writes still granted on %', obj;
    END IF;
  END LOOP;
  FOREACH obj IN ARRAY ARRAY[
    'public.commit_checkout(uuid,text,text,uuid,text,jsonb)',
    'public.consume_api_rate_limit(text,text,integer,integer)'
  ] LOOP
    fn := to_regprocedure(obj);
    IF fn IS NULL THEN RAISE EXCEPTION 'Required RPC missing: %', obj; END IF;
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
      IF has_function_privilege(role_name, fn, 'EXECUTE') THEN
        RAISE EXCEPTION 'Client execution granted on % to %', obj, role_name;
      END IF;
    END LOOP;
    IF NOT has_function_privilege('service_role', fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'Backend execution missing on %', obj;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='payment-proofs' AND public=false) THEN
    RAISE EXCEPTION 'Private payment-proofs bucket missing';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
DO $$
BEGIN
  IF public.is_admin() IS TRUE THEN RAISE EXCEPTION 'Synthetic non-admin identity unexpectedly has membership'; END IF;
  BEGIN
    PERFORM public.admin_dashboard_summary();
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Not authorized' THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Non-admin could read dashboard summary';
END $$;
ROLLBACK;
