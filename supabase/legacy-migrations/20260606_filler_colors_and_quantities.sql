CREATE TABLE IF NOT EXISTS public.filler_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filler_id UUID REFERENCES public.fillers(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    hex_code TEXT,
    is_available BOOLEAN DEFAULT true
);

ALTER TABLE public.filler_colors ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.filler_colors TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filler_colors TO authenticated;

DROP POLICY IF EXISTS filler_colors_public_read ON public.filler_colors;
CREATE POLICY filler_colors_public_read ON public.filler_colors
FOR SELECT
TO anon, authenticated
USING (is_available = true);

DROP POLICY IF EXISTS filler_colors_admin_manage ON public.filler_colors;
CREATE POLICY filler_colors_admin_manage ON public.filler_colors
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

INSERT INTO public.filler_colors (filler_id, color_name, hex_code, is_available)
SELECT f.id, seed.color_name, seed.hex_code, true
FROM public.fillers f
JOIN (
    VALUES
      ('Baby''s Breath', 'White', '#FFFFFF'),
      ('Baby''s Breath', 'Pink', '#FFC0CB'),
      ('Eucalyptus Leaves', 'Green', '#7FB069'),
      ('Fern', 'Green', '#4F7942')
) AS seed(filler_name, color_name, hex_code)
  ON lower(f.name) = lower(seed.filler_name)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.filler_colors fc
    WHERE fc.filler_id = f.id
      AND lower(fc.color_name) = lower(seed.color_name)
);

CREATE OR REPLACE FUNCTION public.calculate_custom_subtotal(p_item JSONB)
RETURNS NUMERIC(10, 2)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total NUMERIC(10, 2);
    v_component JSONB;
    v_price NUMERIC(10, 2);
    v_quantity INTEGER;
    v_addon_key TEXT;
BEGIN
    SELECT base_price INTO v_total
    FROM public.bouquet_sizes
    WHERE key = p_item->>'size'
      AND is_available = true;

    IF v_total IS NULL THEN
        RAISE EXCEPTION 'Invalid custom bouquet size';
    END IF;

    IF jsonb_array_length(COALESCE(p_item->'flowers', '[]'::jsonb)) = 0 THEN
        RAISE EXCEPTION 'A custom bouquet must include at least one flower';
    END IF;

    FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(p_item->'flowers', '[]'::jsonb))
    LOOP
        v_quantity := COALESCE((v_component->>'quantity')::INTEGER, 0);
        SELECT price_per_stem INTO v_price
        FROM public.flowers
        WHERE id = (v_component->>'id')::UUID
          AND is_available = true;

        IF v_price IS NULL OR v_quantity < 1 THEN
            RAISE EXCEPTION 'Invalid custom flower selection';
        END IF;

        v_total := v_total + (v_price * v_quantity);
    END LOOP;

    FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(p_item->'fillers', '[]'::jsonb))
    LOOP
        v_quantity := COALESCE((v_component->>'quantity')::INTEGER, 0);
        SELECT price INTO v_price
        FROM public.fillers
        WHERE id = (v_component->>'id')::UUID
          AND is_available = true;

        IF v_price IS NULL OR v_quantity < 1 THEN
            RAISE EXCEPTION 'Invalid custom filler selection';
        END IF;

        v_total := v_total + (v_price * v_quantity);
    END LOOP;

    IF p_item->'wrapper' IS NOT NULL AND jsonb_typeof(p_item->'wrapper') = 'object' THEN
        PERFORM 1
        FROM public.wrappers
        WHERE id = (p_item#>>'{wrapper,id}')::UUID
          AND is_available = true;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Invalid custom wrapper selection';
        END IF;
    END IF;

    FOR v_addon_key IN
        SELECT key FROM public.bouquet_addons
        WHERE is_available = true
          AND COALESCE((p_item->'addons'->>key)::BOOLEAN, false)
    LOOP
        SELECT price INTO v_price
        FROM public.bouquet_addons
        WHERE key = v_addon_key;
        v_total := v_total + v_price;
    END LOOP;

    RETURN v_total;
END;
$$;

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
            addons, message_card, quantity, subtotal
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
            v_subtotal
        );
    END LOOP;

    RETURN jsonb_build_object('id', v_order_id, 'reference_number', v_reference, 'total_amount', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.place_order(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_custom_subtotal(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_custom_subtotal(JSONB) TO anon, authenticated;
