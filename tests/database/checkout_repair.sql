-- Execute inside a transaction and always roll back. All records are synthetic.
DO $$
DECLARE
  v_product UUID := gen_random_uuid();
  v_session UUID := gen_random_uuid();
  v_request UUID := gen_random_uuid();
  v_order JSONB := jsonb_build_object('customer_name','Synthetic checkout verification','contact_number','TEST-ONLY','facebook_account','TEST-ONLY','payment_method','cash','delivery_method','pickup','preferred_date','2099-01-01','preferred_time','10:00');
  v_quote JSONB; v_result JSONB; v_retry JSONB; v_stock INTEGER;
BEGIN
  INSERT INTO public.bouquets(id,name,price,stock,is_visible) VALUES(v_product,'Synthetic checkout verification',350,5,true);
  INSERT INTO public.checkout_sessions(id,token_hash,client_hash,turnstile_verified_at,expires_at)
    VALUES(v_session,repeat('a',64),repeat('b',64),now(),now()+interval '15 minutes');
  v_quote := public.create_checkout_quote(v_session,repeat('a',64),repeat('c',64),jsonb_build_array(jsonb_build_object('item_type','bouquet','bouquet_id',v_product,'quantity',1)),'pickup');
  ASSERT (v_quote->>'total')::numeric = 350, 'Quote must use the catalog price';
  v_result := public.commit_checkout(v_session,repeat('a',64),repeat('c',64),v_request,repeat('d',64),v_order);
  ASSERT v_result->>'reference_number' IS NOT NULL, 'Checkout must return a reference';
  v_retry := public.commit_checkout(v_session,repeat('a',64),repeat('c',64),v_request,repeat('d',64),v_order);
  ASSERT v_result = v_retry, 'Retry must return the same order';
  SELECT stock INTO v_stock FROM public.bouquets WHERE id=v_product;
  ASSERT v_stock = 4, 'Stock must only be deducted once';
  ASSERT (SELECT count(*) FROM public.inventory_movements WHERE order_id=(v_result->>'id')::uuid) = 1, 'A single inventory movement is required';
  ASSERT (SELECT count(*) FROM public.notification_events WHERE entity_id=(v_result->>'id')::uuid) = 1, 'A single outbox event is required';
  ASSERT (SELECT used_at IS NOT NULL FROM public.checkout_sessions WHERE id=v_session), 'Session must be consumed';
  ASSERT NOT has_table_privilege('anon','public.checkout_sessions','SELECT'), 'Checkout sessions must stay private';
  ASSERT NOT has_function_privilege('anon','public.commit_checkout(uuid,text,text,uuid,text,jsonb)','EXECUTE'), 'Checkout commits must be server only';
  ASSERT has_function_privilege('service_role','public.commit_checkout(uuid,text,text,uuid,text,jsonb)','EXECUTE'), 'Guest API must be allowed to commit';
END $$;
