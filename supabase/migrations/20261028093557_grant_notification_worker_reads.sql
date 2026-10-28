-- The notification worker reads canonical records using the existing server role.
-- RLS bypass does not grant table access; restore read privileges only.
GRANT SELECT ON public.orders, public.order_items, public.bouquets, public.other_products, public.reviews TO service_role;
NOTIFY pgrst, 'reload schema';
