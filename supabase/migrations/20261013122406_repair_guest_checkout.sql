-- Restore the backend required by the deployed guest checkout.
-- Existing orders, stock values, admin controls and catalog data are retained.
-- Only service_role can use checkout sessions and checkout RPCs.

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


REVOKE ALL ON FUNCTION public.consume_api_rate_limit(TEXT,TEXT,INTEGER,INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_rate_limit(TEXT,TEXT,INTEGER,INTEGER) TO service_role;

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
      SELECT name, price, stock INTO v_row FROM public.bouquets WHERE id = v_id AND archived_at IS NULL AND is_visible = true;
      IF v_row IS NULL OR v_row.stock < v_qty THEN RAISE EXCEPTION 'Bouquet unavailable'; END IF;
      v_name := v_row.name; v_price := v_row.price; v_subtotal := v_price * v_qty;
      v_desc := jsonb_build_object('id', v_id, 'name', v_name, 'type', v_type);
      v_canonical := jsonb_build_object('item_type',v_type,'bouquet_id',v_id,'quantity',v_qty,'item_name',v_name,'unit_price',v_price,'subtotal',v_subtotal,'description',v_desc,'message_card',NULLIF(v_item->>'message_card',''));
    ELSIF v_type = 'other_product' THEN
      v_id := NULLIF(v_item->>'other_product_id','')::UUID;
      SELECT name, price, stock INTO v_row FROM public.other_products WHERE id = v_id AND archived_at IS NULL AND is_visible = true AND is_available = true;
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
  SELECT * INTO v_session FROM public.checkout_sessions WHERE id=p_session_id AND token_hash=p_session_token_hash FOR UPDATE;
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
    IF v_row.product_type='bouquet' THEN SELECT stock INTO v_qty FROM public.bouquets WHERE id=v_row.product_id AND archived_at IS NULL AND is_visible=true FOR UPDATE;
    ELSIF v_row.product_type='other_product' THEN SELECT stock INTO v_qty FROM public.other_products WHERE id=v_row.product_id AND archived_at IS NULL AND is_visible=true AND is_available=true FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.validate_order_schedule()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
  v_today DATE := (timezone('Asia/Manila', now()))::date;
BEGIN
  IF NEW.checkout_request_uuid IS NOT NULL THEN
    IF NEW.preferred_date IS NULL OR NEW.preferred_date < v_today THEN
      RAISE EXCEPTION 'Preferred date must be today or later';
    END IF;
    IF NEW.delivery_method = 'pickup' AND NULLIF(trim(COALESCE(NEW.preferred_time, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Pickup time is required';
    END IF;
    IF NEW.preferred_time IS NOT NULL AND NEW.preferred_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
      RAISE EXCEPTION 'Invalid preferred time';
    END IF;
    IF NEW.delivery_method = 'delivery' AND NULLIF(trim(COALESCE(NEW.delivery_address, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Delivery address is required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_validate_schedule ON public.orders;
CREATE TRIGGER orders_validate_schedule
  BEFORE INSERT OR UPDATE OF preferred_date, preferred_time, delivery_method, delivery_address, checkout_request_uuid
  ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_order_schedule();


REVOKE ALL ON FUNCTION public.validate_order_schedule() FROM PUBLIC, anon, authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('payment-proofs','payment-proofs',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=EXCLUDED.file_size_limit,allowed_mime_types=EXCLUDED.allowed_mime_types;

NOTIFY pgrst, 'reload schema';
