-- Always execute inside BEGIN/ROLLBACK. No HTTP calls or messages are sent.
DO $$
DECLARE
  v_id UUID := gen_random_uuid();
  v_claim public.notification_events%ROWTYPE;
  v_new_claim public.notification_events%ROWTYPE;
BEGIN
  INSERT INTO public.notification_events(id,event_type,entity_id,created_at,available_at)
    VALUES(v_id,'review.created',gen_random_uuid(),'1970-01-01',now());
  SELECT * INTO v_claim FROM public.claim_notification_events(1,120);
  ASSERT v_claim.id = v_id, 'Synthetic event must be claimed first';
  ASSERT v_claim.attempts = 1 AND v_claim.lease_expires_at > now(), 'Claim must create an expiring lease';
  ASSERT NOT public.complete_notification_event(v_id,gen_random_uuid()), 'Wrong lease cannot acknowledge';
  ASSERT NOT public.retry_notification_event(v_id,gen_random_uuid(),60,'telegram_rejected'), 'Wrong lease cannot retry';
  ASSERT NOT EXISTS(SELECT 1 FROM public.claim_notification_events(1,120) WHERE id=v_id), 'An active lease must not be claimed again';
  UPDATE public.notification_events SET lease_expires_at=now()-interval '1 second' WHERE id=v_id;
  ASSERT NOT public.complete_notification_event(v_id,v_claim.claim_token), 'Expired lease cannot acknowledge';
  SELECT * INTO v_new_claim FROM public.claim_notification_events(1,120);
  ASSERT v_new_claim.id=v_id AND v_new_claim.claim_token<>v_claim.claim_token, 'Abandoned lease must be reclaimed';
  ASSERT NOT public.complete_notification_event(v_id,v_claim.claim_token), 'Old worker cannot acknowledge a new lease';
  ASSERT public.retry_notification_event(v_id,v_new_claim.claim_token,1,'telegram_rejected'), 'Current lease can schedule retry';
  ASSERT (SELECT available_at >= now()+interval '60 seconds' AND claimed_at IS NULL FROM public.notification_events WHERE id=v_id), 'Retry must clamp the delay and release the lease';
  UPDATE public.notification_events SET available_at=now() WHERE id=v_id;
  SELECT * INTO v_claim FROM public.claim_notification_events(1,120);
  ASSERT public.complete_notification_event(v_id,v_claim.claim_token), 'Current lease can acknowledge';
  ASSERT NOT public.complete_notification_event(v_id,v_claim.claim_token), 'Duplicate acknowledgement must be rejected';
  ASSERT NOT public.authorize_notification_worker(repeat('0',64)), 'Unknown credential must be rejected';
  ASSERT public.authorize_notification_worker((SELECT encode(extensions.digest(decrypted_secret,'sha256'),'hex') FROM vault.decrypted_secrets WHERE name='astraea_notification_worker')), 'Vault credential must authorize by hash';
  ASSERT NOT has_function_privilege('anon','public.authorize_notification_worker(text)','EXECUTE'), 'Vault verifier must be server only';
  ASSERT NOT has_function_privilege('authenticated','public.dispatch_notification_worker(boolean)','EXECUTE'), 'Browser users cannot dispatch';
END $$;
