-- Phase 5 reliability hardening. Additive and safe for existing data.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.commit_checkout(uuid,text,text,uuid,text,jsonb)') IS NULL
    OR to_regclass('public.inventory_movements') IS NULL THEN
    RAISE EXCEPTION 'Apply Phases 2-4 before Phase 5';
  END IF;
END $$;
ALTER TABLE public.bouquets ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.other_products ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS bouquets_active_name_idx ON public.bouquets (name) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS other_products_active_name_idx ON public.other_products (name) WHERE archived_at IS NULL;

DROP POLICY IF EXISTS bouquets_public_read ON public.bouquets;
CREATE POLICY bouquets_public_read ON public.bouquets FOR SELECT TO anon, authenticated
  USING (is_visible = true AND archived_at IS NULL);

DROP POLICY IF EXISTS other_products_public_read ON public.other_products;
CREATE POLICY other_products_public_read ON public.other_products FOR SELECT TO anon, authenticated
  USING (is_visible = true AND archived_at IS NULL);

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

-- Table-level UPDATE overrides column-level revocation. Replace broad grants
-- explicitly, otherwise direct stock snapshot writes bypass atomic RPCs.
REVOKE INSERT, UPDATE, DELETE ON public.bouquets, public.other_products, public.flowers, public.fillers FROM PUBLIC, anon, authenticated;
GRANT INSERT (name, description, price, category, images, is_visible, is_featured),
      UPDATE (name, description, price, category, images, is_visible, is_featured, archived_at) ON public.bouquets TO authenticated;
GRANT INSERT (name, description, price, category, images, is_visible, is_available),
      UPDATE (name, description, price, category, images, is_visible, is_available, archived_at) ON public.other_products TO authenticated;
GRANT INSERT (name, price_per_stem, image_url, is_available), UPDATE (name, price_per_stem, image_url, is_available) ON public.flowers TO authenticated;
GRANT INSERT (name, price, image_url, is_available), UPDATE (name, price, image_url, is_available) ON public.fillers TO authenticated;
REVOKE DELETE ON public.wrappers, public.bouquet_sizes, public.bouquet_addons,
 public.flower_colors, public.filler_colors, public.wrapper_colors, public.fuzzy_wire_colors FROM PUBLIC, anon, authenticated;
-- Restore moderation only; public review submission stays backend-only.
GRANT UPDATE (is_displayed, admin_reply), DELETE ON public.reviews TO authenticated;

CREATE OR REPLACE FUNCTION public.keep_archived_catalog_hidden()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.archived_at IS NOT NULL THEN NEW.is_visible := false; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bouquets_archive_visibility ON public.bouquets;
CREATE TRIGGER bouquets_archive_visibility BEFORE INSERT OR UPDATE ON public.bouquets
FOR EACH ROW EXECUTE FUNCTION public.keep_archived_catalog_hidden();
DROP TRIGGER IF EXISTS other_products_archive_visibility ON public.other_products;
CREATE TRIGGER other_products_archive_visibility BEFORE INSERT OR UPDATE ON public.other_products
FOR EACH ROW EXECUTE FUNCTION public.keep_archived_catalog_hidden();

CREATE INDEX IF NOT EXISTS orders_status_created_id_idx ON public.orders(status, created_at DESC, id);
CREATE INDEX IF NOT EXISTS orders_type_created_id_idx ON public.orders(order_type, created_at DESC, id);

CREATE OR REPLACE FUNCTION public.admin_dashboard_summary()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE result JSONB; today_start TIMESTAMPTZ; month_start TIMESTAMPTZ;
BEGIN
  IF public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Not authorized'; END IF;
  today_start := date_trunc('day', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila';
  month_start := date_trunc('month', now() AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila';
  SELECT jsonb_build_object(
    'ordersToday', count(*) FILTER (WHERE created_at >= today_start),
    'pendingOrders', count(*) FILTER (WHERE status = 'pending'),
    'revenueMonth', COALESCE(sum(total_amount) FILTER (WHERE created_at >= month_start AND status <> 'cancelled' AND is_paid),0),
    'topBouquet', COALESCE((SELECT COALESCE(oi.item_name,b.name,'Custom Bouquet')
      FROM public.order_items oi JOIN public.orders o ON o.id=oi.order_id
      LEFT JOIN public.bouquets b ON b.id=oi.bouquet_id
      WHERE o.created_at >= month_start AND o.status <> 'cancelled' AND oi.item_type IN ('bouquet','custom')
      GROUP BY COALESCE(oi.item_name,b.name,'Custom Bouquet') ORDER BY sum(oi.quantity) DESC, 1 LIMIT 1),'-')
  ) INTO result FROM public.orders;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.admin_dashboard_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_summary() TO authenticated;
REVOKE ALL ON FUNCTION public.validate_order_schedule(), public.keep_archived_catalog_hidden() FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
