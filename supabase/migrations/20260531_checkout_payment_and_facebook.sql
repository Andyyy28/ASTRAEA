ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS facebook_account TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

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
    v_delivery_method TEXT;
    v_payment_method TEXT;
    v_facebook_account TEXT;
    v_payment_proof_url TEXT;
    v_updated_stock INTEGER;
BEGIN
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'An order must contain at least one item';
    END IF;

    v_delivery_method := p_order->>'delivery_method';
    IF v_delivery_method NOT IN ('pickup', 'delivery') THEN
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
                UPDATE public.fillers
                SET stock = stock - v_quantity
                WHERE id = (v_component->>'id')::UUID
                  AND is_available = true
                  AND stock >= v_quantity
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
        v_reference,
        trim(p_order->>'customer_name'),
        trim(p_order->>'contact_number'),
        v_facebook_account,
        v_payment_method,
        v_payment_proof_url,
        CASE WHEN EXISTS (
            SELECT 1 FROM jsonb_array_elements(p_items) item
            WHERE item->>'item_type' = 'custom'
        ) THEN 'custom' ELSE 'ready-made' END,
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
        IF v_item->>'item_type' = 'bouquet' THEN
            v_bouquet_id := NULLIF(v_item->>'bouquet_id', '')::UUID;
            SELECT price * v_quantity INTO v_subtotal
            FROM public.bouquets WHERE id = v_bouquet_id;
        ELSE
            v_bouquet_id := NULL;
            v_subtotal := public.calculate_custom_subtotal(v_item) * v_quantity;
        END IF;

        INSERT INTO public.order_items (
            order_id, item_type, bouquet_id, size, flowers, fillers, wrapper,
            addons, message_card, quantity, subtotal
        ) VALUES (
            v_order_id,
            v_item->>'item_type',
            v_bouquet_id,
            initcap(NULLIF(v_item->>'size', '')),
            v_item->'flowers',
            v_item->'fillers',
            v_item->'wrapper',
            v_item->'addons',
            NULLIF(v_item->>'message_card', ''),
            v_quantity,
            v_subtotal
        );
    END LOOP;

    RETURN jsonb_build_object('id', v_order_id, 'reference_number', v_reference, 'total_amount', v_total);
END;
$$;

DROP POLICY IF EXISTS "Public can upload payment proofs" ON storage.objects;
CREATE POLICY "Public can upload payment proofs"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'bouquets' AND name LIKE 'payment-proofs/%');

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
        OR regexp_replace(contact_number, '[^0-9]', '', 'g') =
           regexp_replace(p_verification, '[^0-9]', '', 'g')
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
