-- Phase 3: quote-backed, transactional checkout and inventory accounting.
-- Apply after 20261001_phase2_customer_security.sql. This migration is additive:
-- existing orders, references, and prices are retained and legacy rows are only
-- flagged when their historical stock deduction cannot be reconstructed safely.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS quote_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS quote_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS quote_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quote_expires_at TIMESTAMPTZ;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_request_uuid UUID,
  ADD COLUMN IF NOT EXISTS checkout_request_hash TEXT,
  ADD COLUMN IF NOT EXISTS checkout_session_id UUID REFERENCES public.checkout_sessions(id),
  ADD COLUMN IF NOT EXISTS quote_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_fee_nonnegative;
ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_fee_nonnegative CHECK (delivery_fee >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS orders_checkout_request_uuid_idx
  ON public.orders (checkout_request_uuid)
  WHERE checkout_request_uuid IS NOT NULL;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS item_name TEXT,
  ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS canonical_description JSONB,
  ADD COLUMN IF NOT EXISTS instructions TEXT;

ALTER TABLE public.bouquets ADD COLUMN IF NOT EXISTS stock_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.other_products ADD COLUMN IF NOT EXISTS stock_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.flowers ADD COLUMN IF NOT EXISTS stock_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.fillers ADD COLUMN IF NOT EXISTS stock_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.other_products DROP CONSTRAINT IF EXISTS other_products_stock_non_negative;
ALTER TABLE public.other_products ADD CONSTRAINT other_products_stock_non_negative CHECK (stock >= 0);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
  product_type TEXT NOT NULL CHECK (product_type IN ('bouquet','other_product','flower','filler')),
  product_id UUID NOT NULL,
  quantity INTEGER,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('deduction','adjustment')),
  reversed_at TIMESTAMPTZ,
  needs_reconciliation BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'checkout',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT inventory_movements_quantity_valid CHECK (quantity IS NULL OR quantity > 0)
);
CREATE INDEX IF NOT EXISTS inventory_movements_order_idx ON public.inventory_movements(order_id);
CREATE INDEX IF NOT EXISTS inventory_movements_product_idx ON public.inventory_movements(product_type, product_id);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_movements FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO service_role;

CREATE TABLE IF NOT EXISTS public.inventory_reconciliation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.inventory_reconciliation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.inventory_reconciliation FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_reconciliation TO service_role;

CREATE TABLE IF NOT EXISTS public.notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('order.created','review.created')),
  entity_id UUID NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  claimed_at TIMESTAMPTZ,
  claim_token UUID,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(event_type, entity_id)
);
CREATE INDEX IF NOT EXISTS notification_events_ready_idx
  ON public.notification_events(available_at, created_at)
  WHERE completed_at IS NULL;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_events TO service_role;

CREATE OR REPLACE FUNCTION public.claim_notification_events(p_limit INTEGER, p_lease_seconds INTEGER)
RETURNS SETOF public.notification_events
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_row public.notification_events%ROWTYPE;
BEGIN
  IF p_limit < 1 OR p_limit > 50 OR p_lease_seconds < 10 OR p_lease_seconds > 3600 THEN RAISE EXCEPTION 'Invalid notification lease'; END IF;
  FOR v_row IN
    SELECT * FROM public.notification_events
    WHERE completed_at IS NULL AND attempts < 10 AND available_at <= timezone('utc'::text, now())
      AND (claimed_at IS NULL OR claimed_at < timezone('utc'::text, now()) - (p_lease_seconds * interval '1 second'))
    ORDER BY created_at, id LIMIT p_limit FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.notification_events SET claimed_at = timezone('utc'::text, now()), claim_token = gen_random_uuid(), attempts = attempts + 1
    WHERE id = v_row.id RETURNING * INTO v_row;
    RETURN NEXT v_row;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_notification_event(p_id UUID, p_claim_token UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.notification_events SET completed_at = timezone('utc'::text, now()), claimed_at = NULL
  WHERE id = p_id AND claim_token = p_claim_token AND completed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END; $$;

CREATE OR REPLACE FUNCTION public.retry_notification_event(p_id UUID, p_claim_token UUID, p_retry_after_seconds INTEGER, p_error_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE public.notification_events SET available_at = timezone('utc'::text, now()) + (LEAST(GREATEST(p_retry_after_seconds, 1), 86400) * interval '1 second'), claimed_at = NULL, last_error = left(p_error_code, 80)
  WHERE id = p_id AND claim_token = p_claim_token AND completed_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count = 1;
END; $$;

REVOKE ALL ON FUNCTION public.claim_notification_events(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_notification_event(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.retry_notification_event(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_events(INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_notification_event(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.retry_notification_event(UUID, UUID, INTEGER, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.create_checkout_quote(
  p_session_id UUID, p_session_token_hash TEXT, p_quote_token_hash TEXT,
  p_items JSONB, p_delivery_method TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session public.checkout_sessions%ROWTYPE;
  v_item JSONB; v_component JSONB; v_canonical JSONB; v_items JSONB := '[]'::jsonb;
  v_type TEXT; v_id UUID; v_qty INTEGER; v_price NUMERIC(10,2); v_subtotal NUMERIC(10,2);
  v_total NUMERIC(10,2) := 0; v_delivery_fee NUMERIC(10,2) := 0; v_name TEXT; v_desc JSONB;
  v_size_key TEXT; v_size_name TEXT; v_wrapper_material TEXT; v_item_quantity INTEGER; v_row RECORD; v_color TEXT; v_color_row RECORD; v_addons JSONB := '[]'::jsonb;
  v_expires TIMESTAMPTZ;
BEGIN
  IF p_session_id IS NULL OR p_session_token_hash !~ '^[0-9a-f]{64}$' OR p_quote_token_hash !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50
     OR p_delivery_method NOT IN ('pickup','delivery') THEN RAISE EXCEPTION 'Invalid quote request'; END IF;
  SELECT * INTO v_session FROM public.checkout_sessions WHERE id = p_session_id AND token_hash = p_session_token_hash AND used_at IS NULL AND expires_at > timezone('utc'::text, now()) FOR UPDATE;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'Checkout session unavailable'; END IF;
  v_expires := LEAST(v_session.expires_at, timezone('utc'::text, now()) + interval '15 minutes');

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_type := v_item->>'item_type'; v_qty := (v_item->>'quantity')::INTEGER;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 50 OR v_type NOT IN ('bouquet','other_product','custom') THEN RAISE EXCEPTION 'Invalid quote item'; END IF;
    v_subtotal := 0; v_desc := '{}'::jsonb; v_name := NULL;
    IF v_type = 'bouquet' THEN
      v_id := NULLIF(v_item->>'bouquet_id','')::UUID;
      SELECT name, price, stock INTO v_row FROM public.bouquets WHERE id = v_id AND is_visible = true;
      IF v_row IS NULL OR v_row.stock < v_qty THEN RAISE EXCEPTION 'Bouquet unavailable'; END IF;
      v_name := v_row.name; v_price := v_row.price; v_subtotal := v_price * v_qty;
      v_desc := jsonb_build_object('id', v_id, 'name', v_name, 'type', v_type);
      v_canonical := jsonb_build_object('item_type',v_type,'bouquet_id',v_id,'quantity',v_qty,'item_name',v_name,'unit_price',v_price,'subtotal',v_subtotal,'description',v_desc,'message_card',NULLIF(v_item->>'message_card',''));
    ELSIF v_type = 'other_product' THEN
      v_id := NULLIF(v_item->>'other_product_id','')::UUID;
      SELECT name, price, stock INTO v_row FROM public.other_products WHERE id = v_id AND is_visible = true AND is_available = true;
      IF v_row IS NULL OR v_row.stock < v_qty THEN RAISE EXCEPTION 'Product unavailable'; END IF;
      v_name := v_row.name; v_price := v_row.price; v_subtotal := v_price * v_qty;
      v_desc := jsonb_build_object('id', v_id, 'name', v_name, 'type', v_type);
      v_canonical := jsonb_build_object('item_type',v_type,'other_product_id',v_id,'quantity',v_qty,'item_name',v_name,'unit_price',v_price,'subtotal',v_subtotal,'description',v_desc,'message_card',NULLIF(v_item->>'message_card',''));
    ELSE
      SELECT bs.key AS size_key, bs.name AS size_name, bs.base_price INTO v_row FROM public.bouquet_sizes bs WHERE bs.key = v_item->>'size' AND bs.is_available = true;
      IF v_row IS NULL THEN RAISE EXCEPTION 'Invalid bouquet size'; END IF;
      v_size_key := v_row.size_key; v_size_name := v_row.size_name; v_price := v_row.base_price; v_name := 'Custom Bouquet'; v_item_quantity := v_qty;
      IF jsonb_typeof(v_item->'flowers') <> 'array' OR jsonb_array_length(v_item->'flowers') = 0 THEN RAISE EXCEPTION 'A custom bouquet needs flowers'; END IF;
      FOR v_component IN SELECT value FROM jsonb_array_elements(v_item->'flowers')
      LOOP
        v_id := (v_component->>'id')::UUID; v_qty := (v_component->>'quantity')::INTEGER;
        SELECT name, price_per_stem, stock INTO v_row FROM public.flowers WHERE id = v_id AND is_available = true;
        IF v_row IS NULL OR v_qty IS NULL OR v_qty < 1 OR v_row.stock < v_qty * v_item_quantity THEN RAISE EXCEPTION 'Flower unavailable'; END IF;
        v_color := NULLIF(trim(v_component->>'color'),'');
        IF v_color IS NOT NULL THEN SELECT color_name INTO v_color_row FROM public.flower_colors WHERE flower_id = v_id AND is_available = true AND lower(color_name)=lower(v_color) LIMIT 1; IF v_color_row IS NULL THEN RAISE EXCEPTION 'Invalid flower color'; END IF; v_color := v_color_row.color_name; END IF;
        v_price := v_price + (v_row.price_per_stem * v_qty);
        v_desc := v_desc || jsonb_build_object('flowers', COALESCE(v_desc->'flowers','[]'::jsonb) || jsonb_build_array(jsonb_build_object('id',v_id,'name',v_row.name,'quantity',v_qty,'color',v_color)));
      END LOOP;
      FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(v_item->'fillers','[]'::jsonb))
      LOOP
        v_id := (v_component->>'id')::UUID; v_qty := (v_component->>'quantity')::INTEGER;
        SELECT name, price, stock INTO v_row FROM public.fillers WHERE id = v_id AND is_available = true;
        IF v_row IS NULL OR v_qty IS NULL OR v_qty < 1 OR v_row.stock < v_qty * v_item_quantity THEN RAISE EXCEPTION 'Filler unavailable'; END IF;
        v_color := NULLIF(trim(v_component->>'color'),'');
        IF v_color IS NOT NULL THEN SELECT color_name INTO v_color_row FROM public.filler_colors WHERE filler_id = v_id AND is_available = true AND lower(color_name)=lower(v_color) LIMIT 1; IF v_color_row IS NULL THEN RAISE EXCEPTION 'Invalid filler color'; END IF; v_color := v_color_row.color_name; END IF;
        v_price := v_price + (v_row.price * v_qty);
        v_desc := v_desc || jsonb_build_object('fillers', COALESCE(v_desc->'fillers','[]'::jsonb) || jsonb_build_array(jsonb_build_object('id',v_id,'name',v_row.name,'quantity',v_qty,'color',v_color)));
      END LOOP;
      IF jsonb_typeof(v_item->'wrapper') = 'object' THEN
        v_id := (v_item#>>'{wrapper,id}')::UUID; SELECT material INTO v_wrapper_material FROM public.wrappers WHERE id=v_id AND is_available=true;
        IF v_wrapper_material IS NULL THEN RAISE EXCEPTION 'Wrapper unavailable'; END IF;
        v_color := NULLIF(trim(v_item#>>'{wrapper,color}'),'');
        IF v_color IS NOT NULL THEN SELECT color_name INTO v_color_row FROM public.wrapper_colors WHERE wrapper_id=v_id AND is_available=true AND lower(color_name)=lower(v_color) LIMIT 1; IF v_color_row IS NULL THEN RAISE EXCEPTION 'Invalid wrapper color'; END IF; v_color := v_color_row.color_name; END IF;
        v_desc := v_desc || jsonb_build_object('wrapper', jsonb_build_object('id',v_id,'material',v_wrapper_material,'color',v_color));
      END IF;
      FOR v_row IN SELECT ba.key AS addon_key,ba.name AS addon_name,ba.price FROM public.bouquet_addons ba WHERE ba.is_available=true AND COALESCE((v_item->'addons'->>ba.key)::boolean,false)
      LOOP
        v_price := v_price + v_row.price; v_addons := v_addons || jsonb_build_array(jsonb_build_object('key',v_row.addon_key,'name',v_row.addon_name,'price',v_row.price));
      END LOOP;
      v_desc := v_desc || jsonb_build_object('size',v_size_key,'size_name',v_size_name,'addons',v_addons);
      v_subtotal := v_price * v_item_quantity;
      v_canonical := jsonb_build_object('item_type',v_type,'quantity',v_item_quantity,'size',v_size_key,'item_name',v_name,'unit_price',v_price,'subtotal',v_subtotal,'description',v_desc,'message_card',NULLIF(v_item->>'message_card',''),'instructions',NULLIF(v_item->>'instructions',''));
      v_addons := '[]'::jsonb;
    END IF;
    v_items := v_items || jsonb_build_array(v_canonical); v_total := v_total + v_subtotal;
  END LOOP;
  IF p_delivery_method = 'delivery' THEN v_delivery_fee := 80.00; END IF;
  v_total := v_total + v_delivery_fee;
  UPDATE public.checkout_sessions SET quote_token_hash=p_quote_token_hash, quote_snapshot=jsonb_build_object('items',v_items,'delivery_method',p_delivery_method,'delivery_fee',v_delivery_fee,'total',v_total,'expires_at',v_expires), quote_created_at=timezone('utc'::text,now()), quote_expires_at=v_expires WHERE id=p_session_id;
  RETURN jsonb_build_object('items',v_items,'delivery_method',p_delivery_method,'delivery_fee',v_delivery_fee,'total',v_total,'expires_at',v_expires);
END; $$;

REVOKE ALL ON FUNCTION public.create_checkout_quote(UUID,TEXT,TEXT,JSONB,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_checkout_quote(UUID,TEXT,TEXT,JSONB,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.commit_checkout(
  p_session_id UUID, p_session_token_hash TEXT, p_quote_token_hash TEXT,
  p_request_uuid UUID, p_request_hash TEXT, p_order JSONB
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_session public.checkout_sessions%ROWTYPE; v_existing public.orders%ROWTYPE;
  v_quote JSONB; v_item JSONB; v_component JSONB; v_order_id UUID; v_item_id UUID;
  v_reference TEXT; v_delivery_method TEXT; v_payment_method TEXT; v_proof TEXT;
  v_total NUMERIC(10,2); v_delivery_fee NUMERIC(10,2); v_status TEXT;
  v_type TEXT; v_product_id UUID; v_qty INTEGER; v_row RECORD; v_req_hash TEXT;
BEGIN
  IF p_session_id IS NULL OR p_session_token_hash !~ '^[0-9a-f]{64}$' OR p_quote_token_hash !~ '^[0-9a-f]{64}$'
     OR p_request_uuid IS NULL OR p_request_hash !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_order) <> 'object' THEN RAISE EXCEPTION 'Invalid checkout request'; END IF;

  -- Authenticate the opaque session token before looking up an idempotent
  -- result. A request UUID alone never grants access to an order result.
  SELECT * INTO v_session FROM public.checkout_sessions WHERE id=p_session_id AND token_hash=p_session_token_hash;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'Checkout session unavailable'; END IF;

  -- A retry after a successful response returns the original result. A UUID
  -- cannot be reused for a different payload.
  SELECT * INTO v_existing FROM public.orders WHERE checkout_request_uuid = p_request_uuid FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF v_existing.checkout_session_id <> p_session_id THEN RAISE EXCEPTION 'Checkout request UUID already used'; END IF;
    IF v_existing.checkout_request_hash <> p_request_hash THEN RAISE EXCEPTION 'Checkout request UUID already used'; END IF;
    RETURN jsonb_build_object('id',v_existing.id,'order_id',v_existing.id,'reference_number',v_existing.reference_number,'total_amount',v_existing.total_amount);
  END IF;

  SELECT * INTO v_session FROM public.checkout_sessions
  WHERE id=p_session_id AND token_hash=p_session_token_hash AND quote_token_hash=p_quote_token_hash
    AND used_at IS NULL AND expires_at > timezone('utc'::text,now()) AND quote_snapshot IS NOT NULL AND quote_expires_at > timezone('utc'::text,now())
  FOR UPDATE;
  IF v_session.id IS NULL THEN RAISE EXCEPTION 'Quote expired or checkout session unavailable'; END IF;
  v_quote := v_session.quote_snapshot; v_total := (v_quote->>'total')::NUMERIC; v_delivery_fee := (v_quote->>'delivery_fee')::NUMERIC;
  v_delivery_method := v_quote->>'delivery_method';
  v_payment_method := lower(trim(p_order->>'payment_method'));
  v_proof := NULLIF(v_session.proof_path,'');
  IF trim(COALESCE(p_order->>'customer_name',''))='' OR trim(COALESCE(p_order->>'contact_number',''))='' OR trim(COALESCE(p_order->>'facebook_account',''))='' THEN RAISE EXCEPTION 'Customer details are required'; END IF;
  IF lower(trim(p_order->>'delivery_method')) <> v_delivery_method THEN RAISE EXCEPTION 'Quote delivery method changed'; END IF;
  IF v_payment_method NOT IN ('cash','gcash') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF v_payment_method='gcash' AND (v_proof IS NULL OR v_proof !~ ('^payment-proofs/'||p_session_id::TEXT||'/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')) THEN RAISE EXCEPTION 'Payment proof is required'; END IF;
  IF v_payment_method='cash' AND v_proof IS NOT NULL THEN RAISE EXCEPTION 'Unexpected payment proof'; END IF;
  IF v_delivery_method='delivery' AND NULLIF(trim(p_order->>'delivery_address'),'') IS NULL THEN RAISE EXCEPTION 'Delivery address is required'; END IF;

  CREATE TEMP TABLE _phase3_demand(product_type TEXT, product_id UUID, quantity INTEGER NOT NULL) ON COMMIT DROP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_quote->'items')
  LOOP
    v_type := v_item->>'item_type'; v_qty := (v_item->>'quantity')::INTEGER;
    IF v_type='bouquet' THEN INSERT INTO _phase3_demand VALUES ('bouquet',(v_item->>'bouquet_id')::UUID,v_qty);
    ELSIF v_type='other_product' THEN INSERT INTO _phase3_demand VALUES ('other_product',(v_item->>'other_product_id')::UUID,v_qty);
    ELSIF v_type='custom' THEN
      FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(v_item#>'{description,flowers}','[]'::jsonb)) LOOP INSERT INTO _phase3_demand VALUES ('flower',(v_component->>'id')::UUID,(v_component->>'quantity')::INTEGER*v_qty); END LOOP;
      FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(v_item#>'{description,fillers}','[]'::jsonb)) LOOP INSERT INTO _phase3_demand VALUES ('filler',(v_component->>'id')::UUID,(v_component->>'quantity')::INTEGER*v_qty); END LOOP;
    ELSE RAISE EXCEPTION 'Invalid quoted item'; END IF;
  END LOOP;
  -- Aggregate first, then lock in a stable product-type/id order.
  CREATE TEMP TABLE _phase3_aggregate ON COMMIT DROP AS SELECT product_type, product_id, SUM(quantity)::INTEGER quantity FROM _phase3_demand GROUP BY product_type, product_id;
  FOR v_row IN SELECT * FROM _phase3_aggregate ORDER BY product_type, product_id LOOP
    IF v_row.product_type='bouquet' THEN SELECT stock INTO v_qty FROM public.bouquets WHERE id=v_row.product_id AND is_visible=true FOR UPDATE;
    ELSIF v_row.product_type='other_product' THEN SELECT stock INTO v_qty FROM public.other_products WHERE id=v_row.product_id AND is_visible=true AND is_available=true FOR UPDATE;
    ELSIF v_row.product_type='flower' THEN SELECT stock INTO v_qty FROM public.flowers WHERE id=v_row.product_id AND is_available=true FOR UPDATE;
    ELSE SELECT stock INTO v_qty FROM public.fillers WHERE id=v_row.product_id AND is_available=true FOR UPDATE; END IF;
    IF v_qty IS NULL OR v_qty < v_row.quantity THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
  END LOOP;
  FOR v_row IN SELECT * FROM _phase3_aggregate ORDER BY product_type, product_id LOOP
    IF v_row.product_type='bouquet' THEN UPDATE public.bouquets SET stock=stock-v_row.quantity, stock_version=stock_version+1 WHERE id=v_row.product_id;
    ELSIF v_row.product_type='other_product' THEN UPDATE public.other_products SET stock=stock-v_row.quantity, stock_version=stock_version+1, is_available=(stock-v_row.quantity)>0 WHERE id=v_row.product_id;
    ELSIF v_row.product_type='flower' THEN UPDATE public.flowers SET stock=stock-v_row.quantity, stock_version=stock_version+1 WHERE id=v_row.product_id;
    ELSE UPDATE public.fillers SET stock=stock-v_row.quantity, stock_version=stock_version+1 WHERE id=v_row.product_id; END IF;
  END LOOP;

  v_reference := 'AC-'||to_char(CURRENT_DATE,'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::TEXT,'-',''),1,8));
  INSERT INTO public.orders(reference_number,customer_name,contact_number,facebook_account,payment_method,payment_proof_url,order_type,delivery_method,delivery_address,preferred_date,preferred_time,special_notes,total_amount,delivery_fee,status,is_paid,checkout_request_uuid,checkout_request_hash,checkout_session_id,quote_expires_at)
  VALUES(v_reference,trim(p_order->>'customer_name'),trim(p_order->>'contact_number'),trim(p_order->>'facebook_account'),v_payment_method,v_proof,CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(v_quote->'items') x WHERE x->>'item_type'='custom') THEN 'custom' WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(v_quote->'items') x WHERE x->>'item_type'='other_product') THEN 'other-product' ELSE 'ready-made' END,v_delivery_method,CASE WHEN v_delivery_method='delivery' THEN trim(p_order->>'delivery_address') END,NULLIF(p_order->>'preferred_date','')::DATE,NULLIF(p_order->>'preferred_time',''),NULLIF(trim(p_order->>'special_notes'),''),v_total,v_delivery_fee,'pending',false,p_request_uuid,p_request_hash,p_session_id,(v_quote->>'expires_at')::TIMESTAMPTZ)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(v_quote->'items')
  LOOP
    INSERT INTO public.order_items(order_id,item_type,bouquet_id,other_product_id,size,flowers,fillers,wrapper,addons,message_card,instructions,quantity,subtotal,item_name,unit_price,canonical_description)
    VALUES(v_order_id,v_item->>'item_type',NULLIF(v_item->>'bouquet_id','')::UUID,NULLIF(v_item->>'other_product_id','')::UUID,NULLIF(v_item->>'size',''),v_item#>'{description,flowers}',v_item#>'{description,fillers}',v_item#>'{description,wrapper}',v_item#>'{description,addons}',NULLIF(v_item->>'message_card',''),NULLIF(v_item->>'instructions',''),(v_item->>'quantity')::INTEGER,(v_item->>'subtotal')::NUMERIC,(v_item->>'item_name'),(v_item->>'unit_price')::NUMERIC,v_item->'description') RETURNING id INTO v_item_id;
    IF v_item->>'item_type'='bouquet' THEN INSERT INTO public.inventory_movements(order_id,order_item_id,product_type,product_id,quantity,movement_type) VALUES(v_order_id,v_item_id,'bouquet',(v_item->>'bouquet_id')::UUID,(v_item->>'quantity')::INTEGER,'deduction');
    ELSIF v_item->>'item_type'='other_product' THEN INSERT INTO public.inventory_movements(order_id,order_item_id,product_type,product_id,quantity,movement_type) VALUES(v_order_id,v_item_id,'other_product',(v_item->>'other_product_id')::UUID,(v_item->>'quantity')::INTEGER,'deduction');
    ELSE
      FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(v_item#>'{description,flowers}','[]'::jsonb)) LOOP INSERT INTO public.inventory_movements(order_id,order_item_id,product_type,product_id,quantity,movement_type) VALUES(v_order_id,v_item_id,'flower',(v_component->>'id')::UUID,(v_component->>'quantity')::INTEGER*(v_item->>'quantity')::INTEGER,'deduction'); END LOOP;
      FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(v_item#>'{description,fillers}','[]'::jsonb)) LOOP INSERT INTO public.inventory_movements(order_id,order_item_id,product_type,product_id,quantity,movement_type) VALUES(v_order_id,v_item_id,'filler',(v_component->>'id')::UUID,(v_component->>'quantity')::INTEGER*(v_item->>'quantity')::INTEGER,'deduction'); END LOOP;
    END IF;
  END LOOP;
  INSERT INTO public.notification_events(event_type,entity_id) VALUES('order.created',v_order_id) ON CONFLICT DO NOTHING;
  UPDATE public.checkout_sessions SET used_at=timezone('utc'::text,now()), order_id=v_order_id WHERE id=p_session_id;
  RETURN jsonb_build_object('id',v_order_id,'order_id',v_order_id,'reference_number',v_reference,'total_amount',v_total);
END; $$;

REVOKE ALL ON FUNCTION public.commit_checkout(UUID,TEXT,TEXT,UUID,TEXT,JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_checkout(UUID,TEXT,TEXT,UUID,TEXT,JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(p_product_type TEXT, p_product_id UUID, p_delta INTEGER)
RETURNS TABLE(stock INTEGER, stock_version INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_stock INTEGER; v_version INTEGER; v_new INTEGER;
BEGIN
  IF NOT public.is_admin() OR p_product_type NOT IN ('bouquet','other_product','flower','filler') OR p_product_id IS NULL OR p_delta IS NULL OR p_delta = 0 OR abs(p_delta) > 100000 THEN RAISE EXCEPTION 'Invalid stock adjustment'; END IF;
  IF p_product_type='bouquet' THEN SELECT b.stock,b.stock_version INTO v_stock,v_version FROM public.bouquets b WHERE b.id=p_product_id FOR UPDATE;
  ELSIF p_product_type='other_product' THEN SELECT p.stock,p.stock_version INTO v_stock,v_version FROM public.other_products p WHERE p.id=p_product_id FOR UPDATE;
  ELSIF p_product_type='flower' THEN SELECT f.stock,f.stock_version INTO v_stock,v_version FROM public.flowers f WHERE f.id=p_product_id FOR UPDATE;
  ELSE SELECT f.stock,f.stock_version INTO v_stock,v_version FROM public.fillers f WHERE f.id=p_product_id FOR UPDATE; END IF;
  IF v_stock IS NULL OR v_stock + p_delta < 0 THEN RAISE EXCEPTION 'Stock adjustment would be negative'; END IF;
  v_new := v_stock + p_delta;
  IF p_product_type='bouquet' THEN UPDATE public.bouquets SET stock=v_new,stock_version=v_version+1 WHERE id=p_product_id;
  ELSIF p_product_type='other_product' THEN UPDATE public.other_products SET stock=v_new,stock_version=v_version+1,is_available=(v_new>0) WHERE id=p_product_id;
  ELSIF p_product_type='flower' THEN UPDATE public.flowers SET stock=v_new,stock_version=v_version+1 WHERE id=p_product_id;
  ELSE UPDATE public.fillers SET stock=v_new,stock_version=v_version+1 WHERE id=p_product_id; END IF;
  INSERT INTO public.inventory_movements(product_type,product_id,quantity,movement_type,source,metadata) VALUES(p_product_type,p_product_id,abs(p_delta),'adjustment','admin',jsonb_build_object('delta',p_delta,'previous_stock',v_stock,'previous_version',v_version));
  RETURN QUERY SELECT v_new,v_version+1;
END; $$;

CREATE OR REPLACE FUNCTION public.set_inventory_stock_with_version(p_product_type TEXT, p_product_id UUID, p_stock INTEGER, p_expected_version INTEGER)
RETURNS TABLE(stock INTEGER, stock_version INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_current INTEGER; v_version INTEGER; v_delta INTEGER;
BEGIN
  IF NOT public.is_admin() OR p_product_type NOT IN ('bouquet','other_product','flower','filler') OR p_product_id IS NULL OR p_stock IS NULL OR p_stock < 0 OR p_stock > 100000 OR p_expected_version IS NULL THEN RAISE EXCEPTION 'Invalid stock correction'; END IF;
  IF p_product_type='bouquet' THEN SELECT b.stock,b.stock_version INTO v_current,v_version FROM public.bouquets b WHERE b.id=p_product_id FOR UPDATE;
  ELSIF p_product_type='other_product' THEN SELECT p.stock,p.stock_version INTO v_current,v_version FROM public.other_products p WHERE p.id=p_product_id FOR UPDATE;
  ELSIF p_product_type='flower' THEN SELECT f.stock,f.stock_version INTO v_current,v_version FROM public.flowers f WHERE f.id=p_product_id FOR UPDATE;
  ELSE SELECT f.stock,f.stock_version INTO v_current,v_version FROM public.fillers f WHERE f.id=p_product_id FOR UPDATE; END IF;
  IF v_current IS NULL THEN RAISE EXCEPTION 'Inventory item not found'; END IF;
  IF v_version <> p_expected_version THEN RAISE EXCEPTION 'Inventory version conflict'; END IF;
  v_delta := p_stock-v_current;
  IF v_delta=0 THEN RETURN QUERY SELECT v_current,v_version; RETURN; END IF;
  RETURN QUERY SELECT * FROM public.adjust_inventory_stock(p_product_type,p_product_id,v_delta);
END; $$;

REVOKE ALL ON FUNCTION public.adjust_inventory_stock(TEXT,UUID,INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_inventory_stock_with_version(TEXT,UUID,INTEGER,INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_inventory_stock(TEXT,UUID,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_inventory_stock_with_version(TEXT,UUID,INTEGER,INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.transition_order_status(p_order_id UUID, p_status TEXT)
RETURNS public.orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order public.orders%ROWTYPE; v_old_rank INTEGER; v_new_rank INTEGER; v_move RECORD; v_count INTEGER;
BEGIN
  IF NOT public.is_admin() OR p_status NOT IN ('pending','confirmed','being-made','ready','completed','cancelled') THEN RAISE EXCEPTION 'Invalid order transition'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status=p_status THEN RETURN v_order; END IF;
  IF v_order.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Order is terminal'; END IF;
  IF p_status='cancelled' THEN
    FOR v_move IN SELECT * FROM public.inventory_movements WHERE order_id=p_order_id AND movement_type='deduction' AND reversed_at IS NULL ORDER BY product_type,product_id,id FOR UPDATE LOOP
      IF v_move.quantity IS NULL THEN
        INSERT INTO public.inventory_reconciliation(order_id,order_item_id,reason,details) VALUES(p_order_id,v_move.order_item_id,'Missing historical movement quantity',v_move.metadata);
        CONTINUE;
      END IF;
      IF v_move.product_type='bouquet' THEN UPDATE public.bouquets SET stock=stock+v_move.quantity,stock_version=stock_version+1 WHERE id=v_move.product_id;
      ELSIF v_move.product_type='other_product' THEN UPDATE public.other_products SET stock=stock+v_move.quantity,stock_version=stock_version+1,is_available=true WHERE id=v_move.product_id;
      ELSIF v_move.product_type='flower' THEN UPDATE public.flowers SET stock=stock+v_move.quantity,stock_version=stock_version+1 WHERE id=v_move.product_id;
      ELSE UPDATE public.fillers SET stock=stock+v_move.quantity,stock_version=stock_version+1 WHERE id=v_move.product_id; END IF;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count <> 1 THEN
        INSERT INTO public.inventory_reconciliation(order_id,order_item_id,reason,details)
        VALUES(p_order_id,v_move.order_item_id,'Inventory product missing during cancellation',jsonb_build_object('product_type',v_move.product_type,'product_id',v_move.product_id,'quantity',v_move.quantity));
        CONTINUE;
      END IF;
      UPDATE public.inventory_movements SET reversed_at=timezone('utc'::text,now()) WHERE id=v_move.id AND reversed_at IS NULL;
    END LOOP;
  ELSE
    v_old_rank := CASE v_order.status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'being-made' THEN 2 WHEN 'ready' THEN 3 WHEN 'completed' THEN 4 ELSE -1 END;
    v_new_rank := CASE p_status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 WHEN 'being-made' THEN 2 WHEN 'ready' THEN 3 WHEN 'completed' THEN 4 ELSE -1 END;
    IF v_new_rank <= v_old_rank THEN RAISE EXCEPTION 'Order status must move forward'; END IF;
  END IF;
  UPDATE public.orders SET status=p_status WHERE id=p_order_id RETURNING * INTO v_order;
  RETURN v_order;
END; $$;

CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id UUID, p_status TEXT)
RETURNS public.orders LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$ SELECT * FROM public.transition_order_status(p_order_id,p_status); $$;

CREATE OR REPLACE FUNCTION public.set_order_paid(p_order_id UUID, p_is_paid BOOLEAN)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.orders SET is_paid=COALESCE(p_is_paid,false) WHERE id=p_order_id RETURNING * INTO v_order;
  IF v_order.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  RETURN v_order;
END; $$;

REVOKE ALL ON FUNCTION public.transition_order_status(UUID,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_order_status(UUID,TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_order_paid(UUID,BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_order_status(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_order_paid(UUID,BOOLEAN) TO authenticated;

-- Best-effort historical ledger preparation. This never changes stock. Rows with
-- missing IDs or quantities are recorded for reconciliation instead of guessed.
DO $$
DECLARE i RECORD; c JSONB; q INTEGER; pid UUID;
BEGIN
  FOR i IN SELECT oi.*, o.id AS parent_order_id FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id LOOP
    IF EXISTS (SELECT 1 FROM public.inventory_movements m WHERE m.order_item_id=i.id) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.orders o WHERE o.id=i.order_id AND o.status='cancelled') THEN
      INSERT INTO public.inventory_reconciliation(order_id,order_item_id,reason,details)
      VALUES(i.order_id,i.id,'Cancelled legacy order requires stock reconciliation',jsonb_build_object('item_type',i.item_type,'quantity',i.quantity));
      CONTINUE;
    END IF;
    IF i.item_type='bouquet' THEN
      -- Historical checkout did not deduct bouquet stock reliably, so do not
      -- invent a movement. Leave an explicit reconciliation task instead.
      INSERT INTO public.inventory_reconciliation(order_id,order_item_id,reason,details) VALUES(i.order_id,i.id,'Legacy bouquet stock deduction is not provable',jsonb_build_object('bouquet_id',i.bouquet_id,'quantity',i.quantity));
    ELSIF i.item_type='other_product' AND i.other_product_id IS NOT NULL AND COALESCE(i.quantity,0)>0 THEN
      INSERT INTO public.inventory_movements(order_id,order_item_id,product_type,product_id,quantity,movement_type,source) VALUES(i.order_id,i.id,'other_product',i.other_product_id,i.quantity,'deduction','legacy');
    ELSIF i.item_type='custom' THEN
      IF jsonb_array_length(COALESCE(i.flowers,'[]'::jsonb)) = 0 AND jsonb_array_length(COALESCE(i.fillers,'[]'::jsonb)) = 0 THEN
        INSERT INTO public.inventory_reconciliation(order_id,order_item_id,reason,details) VALUES(i.order_id,i.id,'Custom item has no reconstructable components',to_jsonb(i));
      END IF;
      FOR c IN SELECT value FROM jsonb_array_elements(COALESCE(i.flowers,'[]'::jsonb)) LOOP
        pid := CASE WHEN c->>'id' ~ '^[0-9a-fA-F-]{36}$' THEN (c->>'id')::UUID ELSE NULL END; q := CASE WHEN c->>'quantity' ~ '^[0-9]+$' THEN (c->>'quantity')::INTEGER * COALESCE(i.quantity,0) ELSE NULL END;
        IF pid IS NULL OR q IS NULL OR q <= 0 THEN INSERT INTO public.inventory_reconciliation(order_id,order_item_id,reason,details) VALUES(i.order_id,i.id,'Incomplete flower quantity',c); ELSE INSERT INTO public.inventory_movements(order_id,order_item_id,product_type,product_id,quantity,movement_type,source) VALUES(i.order_id,i.id,'flower',pid,q,'deduction','legacy'); END IF;
      END LOOP;
      FOR c IN SELECT value FROM jsonb_array_elements(COALESCE(i.fillers,'[]'::jsonb)) LOOP
        pid := CASE WHEN c->>'id' ~ '^[0-9a-fA-F-]{36}$' THEN (c->>'id')::UUID ELSE NULL END; q := CASE WHEN c->>'quantity' ~ '^[0-9]+$' THEN (c->>'quantity')::INTEGER * COALESCE(i.quantity,0) ELSE NULL END;
        IF pid IS NULL OR q IS NULL OR q <= 0 THEN INSERT INTO public.inventory_reconciliation(order_id,order_item_id,reason,details) VALUES(i.order_id,i.id,'Incomplete filler quantity',c); ELSE INSERT INTO public.inventory_movements(order_id,order_item_id,product_type,product_id,quantity,movement_type,source) VALUES(i.order_id,i.id,'filler',pid,q,'deduction','legacy'); END IF;
      END LOOP;
    ELSE
      INSERT INTO public.inventory_reconciliation(order_id,order_item_id,reason,details) VALUES(i.order_id,i.id,'Unrecognized legacy order item',to_jsonb(i));
    END IF;
  END LOOP;
END $$;

-- Orders and order items are read by administrators but can only be created or
-- changed through the backend transaction/status RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.orders, public.order_items FROM anon, authenticated;
GRANT SELECT ON public.orders, public.order_items TO authenticated;
-- Product metadata remains editable by administrators, but stock and its
-- optimistic-lock version can only be changed by the atomic RPCs above.
REVOKE UPDATE (stock, stock_version) ON public.bouquets, public.other_products, public.flowers, public.fillers FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.place_order(JSONB,JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_bouquet_stock(UUID,INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.release_bouquet_stock(UUID,INTEGER) FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
