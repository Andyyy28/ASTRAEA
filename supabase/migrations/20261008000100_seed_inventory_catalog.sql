-- Seed the current flower and filler catalog without touching availability,
-- stock, colors, or photos. Admins can complete those fields in Inventory.
DO $$
DECLARE
  item RECORD;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('Stargazer', 135::numeric), ('Sundrop', 135), ('Lotus', 95),
      ('Sunflower v1', 75), ('Sunflower v2', 50), ('Tulip', 75),
      ('Lavender v1', 40), ('Lavender v2', 25), ('Daisy', 40),
      ('Rose v1', 80), ('Rose v2', 45), ('Gerbera v1', 55),
      ('Gerbera v2', 165), ('Hibiscus', 75), ('Tiger Lily', 65),
      ('Lily', 65), ('Anthurium', 65), ('Poppy', 60)
    ) AS flowers(name, price_per_stem)
  LOOP
    UPDATE public.flowers
    SET price_per_stem = item.price_per_stem
    WHERE lower(name) = lower(item.name);
    IF NOT FOUND THEN
      INSERT INTO public.flowers (name, price_per_stem, stock, is_available)
      VALUES (item.name, item.price_per_stem, 0, false);
    END IF;
  END LOOP;

  FOR item IN
    SELECT * FROM (VALUES
      ('Spirals', 5::numeric), ('Pecan', 15), ('Heart', 15),
      ('Snake Leaves', 23), ('Hydrangea', 25), ('Eucalyptus', 25),
      ('Mini Daisies', 25), ('Olfersea', 30), ('Gypsophilia', 35)
    ) AS fillers(name, price)
  LOOP
    UPDATE public.fillers
    SET price = item.price
    WHERE lower(name) = lower(item.name);
    IF NOT FOUND THEN
      INSERT INTO public.fillers (name, price, stock, is_available)
      VALUES (item.name, item.price, 0, false);
    END IF;
  END LOOP;
END $$;
