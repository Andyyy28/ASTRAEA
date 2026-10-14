-- Restore the durable notification worker without touching orders or inventory.
-- The cron job is prepared inactive; enable it after configuration verification.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.notification_events ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.claim_notification_events(p_limit INTEGER, p_lease_seconds INTEGER)
RETURNS SETOF public.notification_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.notification_events%ROWTYPE;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 5 OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 10 AND 3600 THEN
    RAISE EXCEPTION 'Invalid notification lease';
  END IF;
  FOR v_row IN
    SELECT * FROM public.notification_events
    WHERE completed_at IS NULL AND attempts < 10 AND available_at <= now()
      AND (claimed_at IS NULL OR COALESCE(lease_expires_at, claimed_at + interval '120 seconds') <= now())
    ORDER BY created_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.notification_events
    SET claimed_at = now(), lease_expires_at = now() + p_lease_seconds * interval '1 second',
        claim_token = gen_random_uuid(), attempts = attempts + 1
    WHERE id = v_row.id RETURNING * INTO v_row;
    RETURN NEXT v_row;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_notification_event(p_id UUID, p_claim_token UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.notification_events
  SET completed_at = now(), claimed_at = NULL, lease_expires_at = NULL, claim_token = NULL, last_error = NULL
  WHERE id = p_id AND claim_token = p_claim_token AND completed_at IS NULL
    AND claimed_at IS NOT NULL AND lease_expires_at > now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END; $$;

CREATE OR REPLACE FUNCTION public.retry_notification_event(p_id UUID, p_claim_token UUID, p_retry_after_seconds INTEGER, p_error_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count INTEGER;
BEGIN
  IF p_retry_after_seconds IS NULL OR p_error_code IS NULL OR p_error_code !~ '^[a-z_]{1,80}$' THEN
    RAISE EXCEPTION 'Invalid notification retry';
  END IF;
  UPDATE public.notification_events
  SET available_at = now() + LEAST(GREATEST(p_retry_after_seconds, 60), 86400) * interval '1 second',
      claimed_at = NULL, lease_expires_at = NULL, claim_token = NULL, last_error = p_error_code
  WHERE id = p_id AND claim_token = p_claim_token AND completed_at IS NULL
    AND claimed_at IS NOT NULL AND lease_expires_at > now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END; $$;

REVOKE ALL ON FUNCTION public.claim_notification_events(INTEGER,INTEGER),
  public.complete_notification_event(UUID,UUID), public.retry_notification_event(UUID,UUID,INTEGER,TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_events(INTEGER,INTEGER),
  public.complete_notification_event(UUID,UUID), public.retry_notification_event(UUID,UUID,INTEGER,TEXT)
  TO service_role;

-- Generate the invocation credential inside Vault; never export its value.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'astraea_notification_worker') THEN
    PERFORM vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'astraea_notification_worker', 'Dedicated notification scheduler credential');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'astraea_notification_project_url') THEN
    PERFORM vault.create_secret('https://svldipwhfcguqsqlvhdt.supabase.co', 'astraea_notification_project_url', 'Notification worker project URL');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.authorize_notification_worker(p_token_hash TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_token_hash ~ '^[0-9a-f]{64}$' AND EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'astraea_notification_worker'
      AND encode(extensions.digest(decrypted_secret, 'sha256'), 'hex') = p_token_hash
  );
$$;
REVOKE ALL ON FUNCTION public.authorize_notification_worker(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_notification_worker(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.dispatch_notification_worker(p_dry_run BOOLEAN DEFAULT false)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_token TEXT; v_url TEXT;
BEGIN
  SELECT decrypted_secret INTO v_token FROM vault.decrypted_secrets WHERE name = 'astraea_notification_worker';
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'astraea_notification_project_url';
  IF v_token IS NULL OR length(v_token) < 32 OR v_url IS NULL OR v_url !~ '^https://[a-z0-9]{20}\.supabase\.co$' THEN
    RAISE EXCEPTION 'Notification scheduler is not configured';
  END IF;
  RETURN net.http_post(
    url := v_url || '/functions/v1/notification-worker' || CASE WHEN p_dry_run THEN '?dry_run=true' ELSE '' END,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_token, 'Content-Type', 'application/json'),
    body := '{}'::jsonb, timeout_milliseconds := 15000
  );
END; $$;
REVOKE ALL ON FUNCTION public.dispatch_notification_worker(BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_notification_worker(BOOLEAN) TO service_role;

DO $$
DECLARE v_job BIGINT; v_active BOOLEAN;
BEGIN
  SELECT active INTO v_active FROM cron.job WHERE jobname = 'astraea-telegram-notifications';
  v_job := cron.schedule('astraea-telegram-notifications', '* * * * *', 'SELECT public.dispatch_notification_worker();');
  PERFORM cron.alter_job(v_job, active := COALESCE(v_active, false));
END $$;

NOTIFY pgrst, 'reload schema';
