UPDATE public.wrappers
SET price = 0;

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

REVOKE ALL ON FUNCTION public.calculate_custom_subtotal(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_custom_subtotal(JSONB) TO anon, authenticated;
