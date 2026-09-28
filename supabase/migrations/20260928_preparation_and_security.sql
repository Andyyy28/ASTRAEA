-- Apply after all earlier migrations, before deploying the matching frontend.
BEGIN;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS preparation_minutes INTEGER;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS confirmed_ready_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS timing_note TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS instructions TEXT;

-- Provisional, sequential workshop minutes. Keep in sync with preparation.js.
CREATE OR REPLACE FUNCTION public.estimate_preparation_minutes(p_items JSONB)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp AS $$
DECLARE
  item JSONB; component JSONB; minutes INTEGER; total INTEGER := 0;
  quantity INTEGER; flower_count INTEGER; stems INTEGER; fillers INTEGER; addons INTEGER;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Provide between 1 and 100 order items';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    quantity := (item->>'quantity')::INTEGER;
    IF quantity IS NULL OR quantity NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    minutes := 15;
    IF item->>'item_type' = 'custom' THEN
      stems := 0; fillers := 0; addons := 0;
      flower_count := jsonb_array_length(item->'flowers');
      FOR component IN SELECT value FROM jsonb_array_elements(item->'flowers') LOOP
        IF (component->>'quantity')::INTEGER NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid stem quantity'; END IF;
        stems := stems + (component->>'quantity')::INTEGER;
      END LOOP;
      FOR component IN SELECT value FROM jsonb_array_elements(COALESCE(NULLIF(item->'fillers', 'null'::jsonb), '[]'::jsonb)) LOOP
        IF (component->>'quantity')::INTEGER NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Invalid filler quantity'; END IF;
        fillers := fillers + (component->>'quantity')::INTEGER;
      END LOOP;
      SELECT count(*) INTO addons FROM jsonb_each(COALESCE(NULLIF(item->'addons', 'null'::jsonb), '{}'::jsonb)) WHERE value = 'true'::jsonb;
      minutes := 20 + stems * 8 + flower_count * 5 + fillers * 3 + addons * 10
        + CASE lower(item->>'size') WHEN 'medium' THEN 15 WHEN 'large' THEN 30 ELSE 0 END
        + CASE WHEN jsonb_typeof(item->'wrapper') = 'object' THEN 10 ELSE 0 END
        + CASE WHEN trim(COALESCE(item->>'instructions', '')) <> '' THEN 30 ELSE 0 END;
      minutes := ceil(minutes / 15.0)::INTEGER * 15;
    END IF;
    IF minutes IS NULL THEN RAISE EXCEPTION 'Invalid custom design'; END IF;
    total := total + minutes * quantity;
  END LOOP;
  RETURN total;
END; $$;
REVOKE ALL ON FUNCTION public.estimate_preparation_minutes(JSONB) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.confirm_order_timing(p_order_id UUID, p_ready_at TIMESTAMPTZ, p_note TEXT DEFAULT '')
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result public.orders;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_ready_at IS NULL OR p_ready_at <= now() THEN RAISE EXCEPTION 'Choose a future handoff time'; END IF;
  IF length(COALESCE(p_note, '')) > 500 THEN RAISE EXCEPTION 'Timing note is too long'; END IF;
  UPDATE public.orders SET confirmed_ready_at = p_ready_at, timing_note = NULLIF(trim(p_note), '')
  WHERE id = p_order_id AND status NOT IN ('cancelled', 'completed') RETURNING * INTO result;
  IF result.id IS NULL THEN RAISE EXCEPTION 'Order cannot be scheduled'; END IF;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.confirm_order_timing(UUID, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_order_timing(UUID, TIMESTAMPTZ, TEXT) TO authenticated;

-- Catalog policies call is_admin for anonymous readers as well.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;

-- Public callers must never alter stock independently of a transaction.
REVOKE ALL ON FUNCTION public.reserve_bouquet_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_bouquet_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-proofs', 'payment-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = EXCLUDED.allowed_mime_types;
DROP POLICY IF EXISTS payment_proof_submit ON storage.objects;
CREATE POLICY payment_proof_submit ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'payment-proofs' AND name ~ '^[0-9a-f-]{36}\.(jpg|png|webp)$');
DROP POLICY IF EXISTS payment_proof_admin ON storage.objects;
CREATE POLICY payment_proof_admin ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'payment-proofs' AND public.is_admin())
WITH CHECK (bucket_id = 'payment-proofs' AND public.is_admin());
DROP POLICY IF EXISTS "Admin can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete images" ON storage.objects;
CREATE POLICY "Admin can upload images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'bouquets' AND public.is_admin());
CREATE POLICY "Admin can update images" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'bouquets' AND public.is_admin()) WITH CHECK (bucket_id = 'bouquets' AND public.is_admin());
CREATE POLICY "Admin can delete images" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'bouquets' AND public.is_admin());

CREATE OR REPLACE FUNCTION public.place_order(p_order JSONB, p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order_id UUID;
    v_reference TEXT;
    v_item JSONB;
    v_component JSONB;
    v_quantity INTEGER;
    v_component_quantity INTEGER;
    v_subtotal NUMERIC(10, 2);
    v_total NUMERIC(10, 2) := 0;
    v_bouquet_id UUID;
    v_other_product_id UUID;
    v_delivery_method TEXT;
    v_payment_method TEXT;
    v_facebook_account TEXT;
    v_payment_proof_url TEXT;
    v_updated_stock INTEGER;
    v_minutes INTEGER;
    v_requested TIMESTAMPTZ;
BEGIN
    v_minutes := public.estimate_preparation_minutes(p_items);
    IF NULLIF(p_order->>'preferred_date', '') IS NULL OR NULLIF(p_order->>'preferred_time', '') IS NULL THEN
        RAISE EXCEPTION 'Requested date and time are required';
    END IF;
    v_requested := ((p_order->>'preferred_date')::DATE + (p_order->>'preferred_time')::TIME) AT TIME ZONE 'Asia/Manila';
    IF v_requested < now() + make_interval(mins => v_minutes) THEN
        RAISE EXCEPTION 'Requested time is too soon for this design; please choose a later time';
    END IF;
    IF p_order->>'delivery_method' = 'delivery' AND trim(COALESCE(p_order->>'delivery_address', '')) = '' THEN
        RAISE EXCEPTION 'Delivery address is required';
    END IF;
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'An order must contain at least one item';
    END IF;

    v_delivery_method := p_order->>'delivery_method';
    IF v_delivery_method IS NULL OR v_delivery_method NOT IN ('pickup', 'delivery') THEN
        RAISE EXCEPTION 'Invalid delivery method';
    END IF;

    v_facebook_account := trim(COALESCE(p_order->>'facebook_account', p_order->>'email', ''));
    v_payment_method := lower(trim(COALESCE(p_order->>'payment_method', '')));
    v_payment_proof_url := NULLIF(trim(COALESCE(p_order->>'payment_proof_url', '')), '');

    IF trim(COALESCE(p_order->>'customer_name', '')) = ''
       OR trim(COALESCE(p_order->>'contact_number', '')) = ''
       OR v_facebook_account = '' THEN
        RAISE EXCEPTION 'Customer name, contact number, and Facebook account are required';
    END IF;

    IF v_payment_method NOT IN ('gcash', 'cash') THEN
        RAISE EXCEPTION 'Payment method is required';
    END IF;

    IF v_payment_method = 'gcash' AND v_payment_proof_url IS NULL THEN
        RAISE EXCEPTION 'Proof of payment is required for GCash orders';
    END IF;

    IF v_payment_method = 'gcash' AND NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'payment-proofs' AND name = v_payment_proof_url) THEN
        RAISE EXCEPTION 'Upload payment proof before submitting';
    END IF;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_quantity := COALESCE((v_item->>'quantity')::INTEGER, 0);
        IF v_quantity < 1 THEN
            RAISE EXCEPTION 'Invalid order item quantity';
        END IF;

        IF v_item->>'item_type' = 'bouquet' THEN
            v_bouquet_id := NULLIF(v_item->>'bouquet_id', '')::UUID;
            SELECT price * v_quantity INTO v_subtotal
            FROM public.bouquets
            WHERE id = v_bouquet_id AND is_visible = true;

            IF v_subtotal IS NULL THEN
                RAISE EXCEPTION 'Bouquet is not available';
            END IF;
            UPDATE public.bouquets SET stock = stock - v_quantity
            WHERE id = v_bouquet_id AND is_visible = true AND stock >= v_quantity
            RETURNING stock INTO v_updated_stock;
            IF v_updated_stock IS NULL THEN RAISE EXCEPTION 'Not enough bouquet stock'; END IF;
            v_updated_stock := NULL;
        ELSIF v_item->>'item_type' = 'other_product' THEN
            v_other_product_id := NULLIF(v_item->>'other_product_id', '')::UUID;
            SELECT price * v_quantity INTO v_subtotal
            FROM public.other_products
            WHERE id = v_other_product_id
              AND is_visible = true
              AND is_available = true
              AND stock >= v_quantity;

            IF v_subtotal IS NULL THEN
                RAISE EXCEPTION 'Product is not available';
            END IF;

            UPDATE public.other_products
            SET stock = stock - v_quantity,
                is_available = (stock - v_quantity) > 0
            WHERE id = v_other_product_id
              AND stock >= v_quantity
            RETURNING stock INTO v_updated_stock;

            IF v_updated_stock IS NULL THEN
                RAISE EXCEPTION 'Not enough product stock';
            END IF;
            v_updated_stock := NULL;
        ELSIF v_item->>'item_type' = 'custom' THEN
            v_subtotal := public.calculate_custom_subtotal(v_item) * v_quantity;

            FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(v_item->'flowers', '[]'::jsonb))
            LOOP
                v_component_quantity := COALESCE((v_component->>'quantity')::INTEGER, 0) * v_quantity;
                UPDATE public.flowers
                SET stock = stock - v_component_quantity
                WHERE id = (v_component->>'id')::UUID
                  AND is_available = true
                  AND stock >= v_component_quantity
                RETURNING stock INTO v_updated_stock;

                IF v_updated_stock IS NULL THEN
                    RAISE EXCEPTION 'Not enough flower stock';
                END IF;
                v_updated_stock := NULL;
            END LOOP;

            FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(v_item->'fillers', '[]'::jsonb))
            LOOP
                v_component_quantity := COALESCE((v_component->>'quantity')::INTEGER, 0) * v_quantity;
                UPDATE public.fillers
                SET stock = stock - v_component_quantity
                WHERE id = (v_component->>'id')::UUID
                  AND is_available = true
                  AND stock >= v_component_quantity
                RETURNING stock INTO v_updated_stock;

                IF v_updated_stock IS NULL THEN
                    RAISE EXCEPTION 'Not enough filler stock';
                END IF;
                v_updated_stock := NULL;
            END LOOP;
        ELSE
            RAISE EXCEPTION 'Invalid order item type';
        END IF;

        v_total := v_total + v_subtotal;
    END LOOP;

    IF v_delivery_method = 'delivery' THEN
        v_total := v_total + 80.00;
    END IF;

    v_reference := 'AC-' || to_char(CURRENT_DATE, 'YYYY') || '-' ||
        upper(substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 8));

    INSERT INTO public.orders (
        preparation_minutes,
        reference_number,
        customer_name,
        contact_number,
        facebook_account,
        payment_method,
        payment_proof_url,
        order_type,
        delivery_method,
        delivery_address,
        preferred_date,
        preferred_time,
        special_notes,
        total_amount,
        status,
        is_paid
    ) VALUES (
        v_minutes,
        v_reference,
        trim(p_order->>'customer_name'),
        trim(p_order->>'contact_number'),
        v_facebook_account,
        v_payment_method,
        v_payment_proof_url,
        CASE WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_items) item
            WHERE item->>'item_type' = 'custom'
        ) THEN 'custom' WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_items) item
            WHERE item->>'item_type' = 'other_product'
        ) THEN 'other-product' ELSE 'ready-made' END,
        v_delivery_method,
        CASE WHEN v_delivery_method = 'delivery' THEN NULLIF(trim(p_order->>'delivery_address'), '') ELSE NULL END,
        NULLIF(p_order->>'preferred_date', '')::DATE,
        NULLIF(p_order->>'preferred_time', ''),
        NULLIF(trim(p_order->>'special_notes'), ''),
        v_total,
        'pending',
        false
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
    LOOP
        v_quantity := (v_item->>'quantity')::INTEGER;
        v_bouquet_id := NULL;
        v_other_product_id := NULL;

        IF v_item->>'item_type' = 'bouquet' THEN
            v_bouquet_id := NULLIF(v_item->>'bouquet_id', '')::UUID;
            SELECT price * v_quantity INTO v_subtotal
            FROM public.bouquets WHERE id = v_bouquet_id;
        ELSIF v_item->>'item_type' = 'other_product' THEN
            v_other_product_id := NULLIF(v_item->>'other_product_id', '')::UUID;
            SELECT price * v_quantity INTO v_subtotal
            FROM public.other_products WHERE id = v_other_product_id;
        ELSE
            v_subtotal := public.calculate_custom_subtotal(v_item) * v_quantity;
        END IF;

        INSERT INTO public.order_items (
            order_id, item_type, bouquet_id, other_product_id, size, flowers, fillers, wrapper,
            addons, message_card, quantity, subtotal, instructions
        ) VALUES (
            v_order_id,
            v_item->>'item_type',
            v_bouquet_id,
            v_other_product_id,
            initcap(NULLIF(v_item->>'size', '')),
            v_item->'flowers',
            v_item->'fillers',
            v_item->'wrapper',
            v_item->'addons',
            NULLIF(v_item->>'message_card', ''),
            v_quantity,
            v_subtotal,
            NULLIF(trim(v_item->>'instructions'), '')
        );
    END LOOP;

    RETURN jsonb_build_object('id', v_order_id, 'reference_number', v_reference, 'total_amount', v_total, 'preparation_minutes', v_minutes);
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_custom_subtotal(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_custom_subtotal(JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_order(p_reference TEXT, p_verification TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
BEGIN
    SELECT * INTO v_order
    FROM public.orders
    WHERE upper(reference_number) = upper(trim(p_reference))
      AND (
        lower(COALESCE(facebook_account, email, '')) = lower(trim(p_verification))
        OR (length(regexp_replace(p_verification, '[^0-9]', '', 'g')) >= 7 AND regexp_replace(contact_number, '[^0-9]', '', 'g') =
           regexp_replace(p_verification, '[^0-9]', '', 'g'))
      )
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_order.id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'order', jsonb_build_object(
            'reference_number', v_order.reference_number,
            'customer_name', v_order.customer_name,
            'delivery_method', v_order.delivery_method,
            'preferred_date', v_order.preferred_date,
            'preferred_time', v_order.preferred_time,
            'total_amount', v_order.total_amount,
            'status', v_order.status,
            'preparation_minutes', v_order.preparation_minutes,
            'confirmed_ready_at', v_order.confirmed_ready_at,
            'timing_note', v_order.timing_note,
            'created_at', v_order.created_at
        ),
        'items', COALESCE(
            (SELECT jsonb_agg(to_jsonb(i) - 'order_id')
             FROM public.order_items i
             WHERE i.order_id = v_order.id),
            '[]'::jsonb
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.track_order(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_order(TEXT, TEXT) TO anon, authenticated;

-- Terminal orders cannot be reopened and cancelled repeatedly to inflate stock.
CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id UUID, p_status TEXT)
RETURNS public.orders LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE o public.orders; item public.order_items; component JSONB; amount INTEGER;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('pending','confirmed','being-made','ready','completed','cancelled') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO o FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF o.status = p_status THEN RETURN o; END IF;
  IF o.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'Terminal orders cannot be reopened'; END IF;
  IF p_status = 'cancelled' THEN
    FOR item IN SELECT * FROM public.order_items WHERE order_id = p_order_id LOOP
      IF item.item_type = 'bouquet' THEN
        UPDATE public.bouquets SET stock = stock + item.quantity WHERE id = item.bouquet_id;
      ELSIF item.item_type = 'other_product' THEN
        UPDATE public.other_products SET stock = stock + item.quantity, is_available = true WHERE id = item.other_product_id;
      ELSIF item.item_type = 'custom' THEN
        FOR component IN SELECT value FROM jsonb_array_elements(item.flowers) LOOP
          amount := (component->>'quantity')::INTEGER * item.quantity;
          UPDATE public.flowers SET stock = stock + amount WHERE id = (component->>'id')::UUID;
        END LOOP;
        FOR component IN SELECT value FROM jsonb_array_elements(COALESCE(NULLIF(item.fillers, 'null'::jsonb), '[]'::jsonb)) LOOP
          amount := (component->>'quantity')::INTEGER * item.quantity;
          UPDATE public.fillers SET stock = stock + amount WHERE id = (component->>'id')::UUID;
        END LOOP;
      END IF;
    END LOOP;
  END IF;
  UPDATE public.orders SET status = p_status,
    confirmed_ready_at = CASE WHEN p_status = 'cancelled' THEN NULL ELSE confirmed_ready_at END
  WHERE id = p_order_id RETURNING * INTO o;
  RETURN o;
END; $$;
REVOKE ALL ON FUNCTION public.update_order_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, TEXT) TO authenticated;
DROP POLICY IF EXISTS "Admin can upload addon images" ON storage.objects;
CREATE POLICY "Admin can upload addon images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'addons' AND public.is_admin());
DROP POLICY IF EXISTS "Admin can update addon images" ON storage.objects;
CREATE POLICY "Admin can update addon images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'addons' AND public.is_admin()) WITH CHECK (bucket_id = 'addons' AND public.is_admin());
DROP POLICY IF EXISTS "Admin can delete addon images" ON storage.objects;
CREATE POLICY "Admin can delete addon images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'addons' AND public.is_admin());
DROP POLICY IF EXISTS "Admin can upload other product images" ON storage.objects;
CREATE POLICY "Admin can upload other product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'other-products' AND public.is_admin());
DROP POLICY IF EXISTS "Admin can update other product images" ON storage.objects;
CREATE POLICY "Admin can update other product images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'other-products' AND public.is_admin()) WITH CHECK (bucket_id = 'other-products' AND public.is_admin());
DROP POLICY IF EXISTS "Admin can delete other product images" ON storage.objects;
CREATE POLICY "Admin can delete other product images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'other-products' AND public.is_admin());
NOTIFY pgrst, 'reload schema';
COMMIT;
