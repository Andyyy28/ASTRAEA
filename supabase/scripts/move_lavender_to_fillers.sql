BEGIN;
INSERT INTO public.fillers (id,name,price,stock,is_available,image_url,stock_version)
SELECT id,name,price_per_stem,stock,is_available,image_url,stock_version FROM public.flowers WHERE name IN ('Lavender v1','Lavender v2')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.filler_colors (id,filler_id,color_name,hex_code,is_available)
SELECT c.id,c.flower_id,c.color_name,c.hex_code,c.is_available FROM public.flower_colors c JOIN public.flowers f ON f.id=c.flower_id JOIN public.fillers fi ON fi.id=f.id WHERE f.name IN ('Lavender v1','Lavender v2')
ON CONFLICT (id) DO NOTHING;
DELETE FROM public.flowers f USING public.fillers fi WHERE f.id=fi.id AND f.name=fi.name AND f.name IN ('Lavender v1','Lavender v2');
COMMIT;
