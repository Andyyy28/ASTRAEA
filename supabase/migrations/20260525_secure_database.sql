-- Secure application access and expose narrowly scoped customer operations.
-- Apply after ../schema.sql for a new project, or apply directly to an existing
-- project that already contains the Astraea tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_users (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.flower_colors (flower_id, color_name, hex_code, is_available)
SELECT seed.flower_id::UUID, seed.color_name, seed.hex_code, seed.is_available
FROM (VALUES
('22222222-2222-2222-2222-222222222222', 'Pink', '#FFC0CB', true),
('22222222-2222-2222-2222-222222222222', 'White', '#FFFFFF', true),
('33333333-3333-3333-3333-333333333333', 'Yellow', '#FFD54F', true),
('33333333-3333-3333-3333-333333333333', 'Orange', '#FFB74D', true),
('44444444-4444-4444-4444-444444444444', 'White', '#FFFFFF', true),
('44444444-4444-4444-4444-444444444444', 'Pink', '#FFC0CB', true),
('55555555-5555-5555-5555-555555555555', 'White', '#FFFFFF', true),
('55555555-5555-5555-5555-555555555555', 'Pink', '#F8BBD0', true)
) AS seed(flower_id, color_name, hex_code, is_available)
WHERE NOT EXISTS (
    SELECT 1 FROM public.flower_colors fc
    WHERE fc.flower_id = seed.flower_id::UUID
      AND lower(fc.color_name) = lower(seed.color_name)
);

INSERT INTO public.wrapper_colors (wrapper_id, color_name, hex_code, is_available)
SELECT seed.wrapper_id::UUID, seed.color_name, seed.hex_code, seed.is_available
FROM (VALUES
('77777777-7777-7777-7777-777777777777', 'Pink', '#FFC0CB', true),
('77777777-7777-7777-7777-777777777777', 'Cream', '#FFFDD0', true),
('88888888-8888-8888-8888-888888888888', 'White', '#FFFFFF', true),
('88888888-8888-8888-8888-888888888888', 'Blush', '#F9D5D3', true)
) AS seed(wrapper_id, color_name, hex_code, is_available)
WHERE NOT EXISTS (
    SELECT 1 FROM public.wrapper_colors wc
    WHERE wc.wrapper_id = seed.wrapper_id::UUID
      AND lower(wc.color_name) = lower(seed.color_name)
);

UPDATE public.bouquets SET category = 'Romantic'
WHERE name IN ('Sweet Blush Rose', 'Grand Romance') AND category = 'Rose';
UPDATE public.bouquets SET category = 'Birthday'
WHERE name = 'Sunshine Sunflower' AND category = 'Sunflower';
UPDATE public.bouquets SET category = 'Other'
WHERE name = 'Elegant Lily Dream' AND category = 'Lily';

ALTER TABLE public.bouquets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flower_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fillers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrappers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrapper_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS bouquets_public_read ON public.bouquets;
CREATE POLICY bouquets_public_read ON public.bouquets
FOR SELECT TO anon, authenticated
USING (is_visible);

DROP POLICY IF EXISTS flowers_public_read ON public.flowers;
CREATE POLICY flowers_public_read ON public.flowers
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS flower_colors_public_read ON public.flower_colors;
CREATE POLICY flower_colors_public_read ON public.flower_colors
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS fillers_public_read ON public.fillers;
CREATE POLICY fillers_public_read ON public.fillers
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS wrappers_public_read ON public.wrappers;
CREATE POLICY wrappers_public_read ON public.wrappers
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS wrapper_colors_public_read ON public.wrapper_colors;
CREATE POLICY wrapper_colors_public_read ON public.wrapper_colors
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS reviews_public_read ON public.reviews;
CREATE POLICY reviews_public_read ON public.reviews
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS bouquets_admin_manage ON public.bouquets;
CREATE POLICY bouquets_admin_manage ON public.bouquets
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS flowers_admin_manage ON public.flowers;
CREATE POLICY flowers_admin_manage ON public.flowers
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS flower_colors_admin_manage ON public.flower_colors;
CREATE POLICY flower_colors_admin_manage ON public.flower_colors
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS fillers_admin_manage ON public.fillers;
CREATE POLICY fillers_admin_manage ON public.fillers
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS wrappers_admin_manage ON public.wrappers;
CREATE POLICY wrappers_admin_manage ON public.wrappers
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS wrapper_colors_admin_manage ON public.wrapper_colors;
CREATE POLICY wrapper_colors_admin_manage ON public.wrapper_colors
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS orders_admin_manage ON public.orders;
CREATE POLICY orders_admin_manage ON public.orders
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS order_items_admin_manage ON public.order_items;
CREATE POLICY order_items_admin_manage ON public.order_items
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS reviews_admin_manage ON public.reviews;
CREATE POLICY reviews_admin_manage ON public.reviews
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS settings_admin_manage ON public.settings;
CREATE POLICY settings_admin_manage ON public.settings
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS admin_users_self_read ON public.admin_users;
CREATE POLICY admin_users_self_read ON public.admin_users
FOR SELECT TO authenticated
USING (user_id = auth.uid());

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
BEGIN
    v_total := CASE p_item->>'size'
        WHEN 'small' THEN 150.00
        WHEN 'medium' THEN 250.00
        WHEN 'large' THEN 400.00
        ELSE NULL
    END;

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
        FROM public.flowers WHERE id = (v_component->>'id')::UUID;
        IF v_price IS NULL OR v_quantity < 1 THEN
            RAISE EXCEPTION 'Invalid custom flower selection';
        END IF;
        v_total := v_total + (v_price * v_quantity);
    END LOOP;

    FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(p_item->'fillers', '[]'::jsonb))
    LOOP
        SELECT price INTO v_price
        FROM public.fillers
        WHERE id = (v_component->>'id')::UUID AND is_available = true;
        IF v_price IS NULL THEN
            RAISE EXCEPTION 'Invalid custom filler selection';
        END IF;
        v_total := v_total + v_price;
    END LOOP;

    IF p_item->'wrapper' IS NOT NULL AND jsonb_typeof(p_item->'wrapper') = 'object' THEN
        SELECT price INTO v_price
        FROM public.wrappers WHERE id = (p_item#>>'{wrapper,id}')::UUID;
        IF v_price IS NULL THEN
            RAISE EXCEPTION 'Invalid custom wrapper selection';
        END IF;
        v_total := v_total + v_price;
    END IF;

    IF COALESCE((p_item#>>'{addons,ribbon}')::BOOLEAN, false) THEN
        v_total := v_total + 20.00;
    END IF;
    IF COALESCE((p_item#>>'{addons,messageCard}')::BOOLEAN, false) THEN
        v_total := v_total + 15.00;
    END IF;

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
    v_quantity INTEGER;
    v_subtotal NUMERIC(10, 2);
    v_total NUMERIC(10, 2) := 0;
    v_bouquet_id UUID;
    v_delivery_method TEXT;
BEGIN
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'An order must contain at least one item';
    END IF;

    v_delivery_method := p_order->>'delivery_method';
    IF v_delivery_method NOT IN ('pickup', 'delivery') THEN
        RAISE EXCEPTION 'Invalid delivery method';
    END IF;

    IF trim(COALESCE(p_order->>'customer_name', '')) = ''
       OR trim(COALESCE(p_order->>'contact_number', '')) = ''
       OR trim(COALESCE(p_order->>'email', '')) = '' THEN
        RAISE EXCEPTION 'Customer name, contact number, and email are required';
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
        email,
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
        trim(p_order->>'email'),
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
        lower(email) = lower(trim(p_verification))
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
REVOKE ALL ON FUNCTION public.calculate_custom_subtotal(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_order(TEXT, TEXT) TO anon, authenticated;
