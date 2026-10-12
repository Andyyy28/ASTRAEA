-- Targeted repair for existing installations missing admin catalog dependencies.
-- Preserves catalog records, order history, and current stock quantities.
-- The full checkout/security upgrade is a separate rollout.
ALTER TABLE public.bouquets ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.other_products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.bouquets ADD COLUMN IF NOT EXISTS stock_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.other_products ADD COLUMN IF NOT EXISTS stock_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.flowers ADD COLUMN IF NOT EXISTS stock_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.fillers ADD COLUMN IF NOT EXISTS stock_version INTEGER NOT NULL DEFAULT 1;
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

CREATE OR REPLACE FUNCTION public.adjust_inventory_stock(p_product_type TEXT, p_product_id UUID, p_delta INTEGER)
RETURNS TABLE(stock INTEGER, stock_version INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_stock INTEGER; v_version INTEGER; v_new INTEGER;
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() IS NOT TRUE OR p_product_type IS NULL OR p_product_type NOT IN ('bouquet','other_product','flower','filler') OR p_product_id IS NULL OR p_delta IS NULL OR p_delta = 0 OR p_delta NOT BETWEEN -100000 AND 100000 THEN RAISE EXCEPTION 'Invalid stock adjustment'; END IF;
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
  IF auth.uid() IS NULL OR public.is_admin() IS NOT TRUE OR p_product_type IS NULL OR p_product_type NOT IN ('bouquet','other_product','flower','filler') OR p_product_id IS NULL OR p_stock IS NULL OR p_stock < 0 OR p_stock > 100000 OR p_expected_version IS NULL THEN RAISE EXCEPTION 'Invalid stock correction'; END IF;
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


NOTIFY pgrst, 'reload schema';

