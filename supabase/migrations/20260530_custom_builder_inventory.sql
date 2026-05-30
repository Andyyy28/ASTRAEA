-- Admin-driven custom bouquet inventory, images, sizes, add-ons, and stock.

ALTER TABLE public.flowers ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.flowers ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE public.flowers ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.fillers ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.fillers ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.wrappers ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.wrappers ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS public.fuzzy_wire_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color_name TEXT NOT NULL,
    hex_code TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.wrapper_colors ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE public.fuzzy_wire_colors ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'flowers_stock_non_negative'
          AND conrelid = 'public.flowers'::regclass
    ) THEN
        ALTER TABLE public.flowers
        ADD CONSTRAINT flowers_stock_non_negative CHECK (stock >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fillers_stock_non_negative'
          AND conrelid = 'public.fillers'::regclass
    ) THEN
        ALTER TABLE public.fillers
        ADD CONSTRAINT fillers_stock_non_negative CHECK (stock >= 0);
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.bouquet_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    stems TEXT,
    base_price NUMERIC(10, 2) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.bouquet_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.bouquet_sizes (key, name, stems, base_price, display_order, is_available)
VALUES
    ('small', 'Small', '5-8 stems', 150.00, 1, true),
    ('medium', 'Medium', '10-15 stems', 250.00, 2, true),
    ('large', 'Large', '18-25 stems', 400.00, 3, true)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    stems = EXCLUDED.stems,
    base_price = EXCLUDED.base_price,
    display_order = EXCLUDED.display_order;

INSERT INTO public.bouquet_addons (key, name, price, display_order, is_available)
VALUES
    ('ribbon', 'Premium Satin Ribbon', 20.00, 1, true),
    ('messageCard', 'Message Card', 15.00, 2, true)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    display_order = EXCLUDED.display_order;

ALTER TABLE public.bouquet_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bouquet_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuzzy_wire_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flower_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fillers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrappers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrapper_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.flowers TO anon, authenticated;
GRANT SELECT ON public.flower_colors TO anon, authenticated;
GRANT SELECT ON public.fillers TO anon, authenticated;
GRANT SELECT ON public.wrappers TO anon, authenticated;
GRANT SELECT ON public.wrapper_colors TO anon, authenticated;
GRANT SELECT ON public.fuzzy_wire_colors TO anon, authenticated;
GRANT SELECT ON public.bouquet_sizes TO anon, authenticated;
GRANT SELECT ON public.bouquet_addons TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.flowers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flower_colors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fillers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wrappers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wrapper_colors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuzzy_wire_colors TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bouquet_sizes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bouquet_addons TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;

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

DROP POLICY IF EXISTS bouquet_sizes_public_read ON public.bouquet_sizes;
CREATE POLICY bouquet_sizes_public_read ON public.bouquet_sizes
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS bouquet_addons_public_read ON public.bouquet_addons;
CREATE POLICY bouquet_addons_public_read ON public.bouquet_addons
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS fuzzy_wire_colors_public_read ON public.fuzzy_wire_colors;
CREATE POLICY fuzzy_wire_colors_public_read ON public.fuzzy_wire_colors
FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS bouquet_sizes_admin_manage ON public.bouquet_sizes;
CREATE POLICY bouquet_sizes_admin_manage ON public.bouquet_sizes
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS bouquet_addons_admin_manage ON public.bouquet_addons;
CREATE POLICY bouquet_addons_admin_manage ON public.bouquet_addons
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS fuzzy_wire_colors_admin_manage ON public.fuzzy_wire_colors;
CREATE POLICY fuzzy_wire_colors_admin_manage ON public.fuzzy_wire_colors
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

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
        SELECT price INTO v_price
        FROM public.fillers
        WHERE id = (v_component->>'id')::UUID
          AND is_available = true;

        IF v_price IS NULL THEN
            RAISE EXCEPTION 'Invalid custom filler selection';
        END IF;

        v_total := v_total + v_price;
    END LOOP;

    IF p_item->'wrapper' IS NOT NULL AND jsonb_typeof(p_item->'wrapper') = 'object' THEN
        SELECT price INTO v_price
        FROM public.wrappers
        WHERE id = (p_item#>>'{wrapper,id}')::UUID
          AND is_available = true;

        IF v_price IS NULL THEN
            RAISE EXCEPTION 'Invalid custom wrapper selection';
        END IF;

        v_total := v_total + v_price;
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
    v_delivery_method TEXT;
    v_updated_stock INTEGER;
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

REVOKE ALL ON FUNCTION public.place_order(JSONB, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_custom_subtotal(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_order(JSONB, JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.update_order_status(p_order_id UUID, p_status TEXT)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_previous_status TEXT;
    v_item public.order_items%ROWTYPE;
    v_component JSONB;
    v_component_quantity INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    IF p_status NOT IN ('pending', 'confirmed', 'being-made', 'ready', 'completed', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid order status';
    END IF;

    SELECT status INTO v_previous_status
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF v_previous_status IS NULL THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    IF p_status = 'cancelled' AND v_previous_status <> 'cancelled' THEN
        UPDATE public.bouquets b
        SET stock = b.stock + oi.quantity
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id
          AND oi.item_type = 'bouquet'
          AND oi.bouquet_id = b.id;

        FOR v_item IN
            SELECT * FROM public.order_items
            WHERE order_id = p_order_id AND item_type = 'custom'
        LOOP
            FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(v_item.flowers, '[]'::jsonb))
            LOOP
                v_component_quantity := COALESCE((v_component->>'quantity')::INTEGER, 0) * COALESCE(v_item.quantity, 1);
                UPDATE public.flowers
                SET stock = stock + GREATEST(v_component_quantity, 0)
                WHERE id = (v_component->>'id')::UUID;
            END LOOP;

            FOR v_component IN SELECT value FROM jsonb_array_elements(COALESCE(v_item.fillers, '[]'::jsonb))
            LOOP
                UPDATE public.fillers
                SET stock = stock + COALESCE(v_item.quantity, 1)
                WHERE id = (v_component->>'id')::UUID;
            END LOOP;
        END LOOP;
    END IF;

    UPDATE public.orders
    SET status = p_status
    WHERE id = p_order_id
    RETURNING * INTO v_order;

    RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, TEXT) TO authenticated;

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
            'id', v_order.id,
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

REVOKE ALL ON FUNCTION public.track_order(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_order(TEXT, TEXT) TO anon, authenticated;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'order_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
