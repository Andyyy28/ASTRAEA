ALTER TABLE public.bouquets ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bouquets_stock_non_negative'
          AND conrelid = 'public.bouquets'::regclass
    ) THEN
        ALTER TABLE public.bouquets
        ADD CONSTRAINT bouquets_stock_non_negative CHECK (stock >= 0);
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_bouquet_stock(p_bouquet_id UUID, p_quantity INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_stock INTEGER;
    v_quantity INTEGER := GREATEST(COALESCE(p_quantity, 1), 1);
BEGIN
    UPDATE public.bouquets
    SET stock = stock - v_quantity
    WHERE id = p_bouquet_id
      AND is_visible = true
      AND stock >= v_quantity
    RETURNING stock INTO v_stock;

    RETURN v_stock;
END;
$$;

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.release_bouquet_stock(p_bouquet_id UUID, p_quantity INTEGER DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_stock INTEGER;
    v_quantity INTEGER := GREATEST(COALESCE(p_quantity, 1), 1);
BEGIN
    UPDATE public.bouquets
    SET stock = stock + v_quantity
    WHERE id = p_bouquet_id
    RETURNING stock INTO v_stock;

    RETURN v_stock;
END;
$$;

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

REVOKE ALL ON FUNCTION public.reserve_bouquet_stock(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_bouquet_stock(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_order_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_bouquet_stock(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_bouquet_stock(UUID, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, TEXT) TO authenticated;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'bouquets'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.bouquets;
    END IF;
END;
$$;
