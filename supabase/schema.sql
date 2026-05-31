-- ================================================
-- ASTRAEA COLLECTION - FULL DATABASE SETUP
-- Run this ENTIRE script in the Supabase SQL Editor
-- After this initial schema is applied, run migrations/20260525_secure_database.sql.
-- ================================================

-- ================================================
-- 1. DROP EXISTING TABLES & POLICIES (clean slate)
-- ================================================
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS flower_colors CASCADE;
DROP TABLE IF EXISTS wrapper_colors CASCADE;
DROP TABLE IF EXISTS fuzzy_wire_colors CASCADE;
DROP TABLE IF EXISTS bouquet_addons CASCADE;
DROP TABLE IF EXISTS bouquet_sizes CASCADE;
DROP TABLE IF EXISTS flowers CASCADE;
DROP TABLE IF EXISTS fillers CASCADE;
DROP TABLE IF EXISTS wrappers CASCADE;
DROP TABLE IF EXISTS bouquets CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS settings CASCADE;


-- ================================================
-- 2. CREATE ALL TABLES
-- ================================================

-- bouquets
CREATE TABLE bouquets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category TEXT,
    images TEXT[],
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_visible BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- other_products
CREATE TABLE other_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    category TEXT CHECK (category IN ('keychain', 'hair accessories', 'ornaments', 'other')),
    images TEXT[],
    is_visible BOOLEAN DEFAULT true,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- flowers
CREATE TABLE flowers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price_per_stem DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- flower_colors
CREATE TABLE flower_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flower_id UUID REFERENCES flowers(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    hex_code TEXT,
    is_available BOOLEAN DEFAULT true
);

-- fillers
CREATE TABLE fillers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_available BOOLEAN DEFAULT true
);

-- wrappers
CREATE TABLE wrappers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true
);

-- wrapper_colors
CREATE TABLE wrapper_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wrapper_id UUID REFERENCES wrappers(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    hex_code TEXT,
    is_available BOOLEAN DEFAULT true
);

-- fuzzy_wire_colors
CREATE TABLE fuzzy_wire_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    color_name TEXT NOT NULL,
    hex_code TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- bouquet_sizes
CREATE TABLE bouquet_sizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    stems TEXT,
    base_price DECIMAL(10, 2) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- bouquet_addons
CREATE TABLE bouquet_addons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    email TEXT,
    facebook_account TEXT,
    payment_method TEXT,
    payment_proof_url TEXT,
    order_type TEXT NOT NULL,
    delivery_method TEXT NOT NULL,
    delivery_address TEXT,
    preferred_date DATE,
    preferred_time TEXT,
    special_notes TEXT,
    total_amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending',
    is_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- order_items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    bouquet_id UUID REFERENCES bouquets(id),
    other_product_id UUID REFERENCES other_products(id),
    size TEXT,
    flowers JSONB,
    fillers JSONB,
    wrapper JSONB,
    addons JSONB,
    message_card TEXT,
    quantity INTEGER DEFAULT 1,
    subtotal DECIMAL(10, 2) NOT NULL
);

-- reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    message TEXT NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    is_displayed BOOLEAN DEFAULT false,
    admin_reply TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- settings
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL
);


-- ================================================
-- 3. STORAGE BUCKET FOR BOUQUET IMAGES
-- ================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('bouquets', 'bouquets', true),
  ('other-products', 'other-products', true),
  ('images', 'images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Admin upload bouquet images" ON storage.objects;
DROP POLICY IF EXISTS "Admin manage bouquet images" ON storage.objects;
DROP POLICY IF EXISTS "Public view bouquet images" ON storage.objects;

DROP POLICY IF EXISTS "Admin can upload images" ON storage.objects;
CREATE POLICY "Admin can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'bouquets');

DROP POLICY IF EXISTS "Admin can update images" ON storage.objects;
CREATE POLICY "Admin can update images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'bouquets')
WITH CHECK (bucket_id = 'bouquets');

DROP POLICY IF EXISTS "Admin can delete images" ON storage.objects;
CREATE POLICY "Admin can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'bouquets');

DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
CREATE POLICY "Public can view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'bouquets');


-- ================================================
-- 4. SEED DATA
-- ================================================

-- Flowers
INSERT INTO flowers (id, name, price_per_stem, stock, is_available) VALUES
('11111111-1111-1111-1111-111111111111', 'Rose', 50.00, 20, true),
('22222222-2222-2222-2222-222222222222', 'Tulip', 60.00, 20, true),
('33333333-3333-3333-3333-333333333333', 'Sunflower', 80.00, 20, true),
('44444444-4444-4444-4444-444444444444', 'Daisy', 40.00, 20, true),
('55555555-5555-5555-5555-555555555555', 'Lily', 70.00, 20, true);

-- Flower Colors
INSERT INTO flower_colors (flower_id, color_name, hex_code, is_available) VALUES
('11111111-1111-1111-1111-111111111111', 'Red', '#FF0000', true),
('11111111-1111-1111-1111-111111111111', 'Pink', '#FFC0CB', true),
('11111111-1111-1111-1111-111111111111', 'White', '#FFFFFF', true),
('11111111-1111-1111-1111-111111111111', 'Yellow', '#FFFF00', true),
('11111111-1111-1111-1111-111111111111', 'Purple', '#800080', false),
('11111111-1111-1111-1111-111111111111', 'Peach', '#FFDAB9', false);

-- Fillers
INSERT INTO fillers (name, price, stock, is_available) VALUES
('Baby''s Breath', 30.00, 20, true),
('Eucalyptus Leaves', 25.00, 20, true),
('Fern', 20.00, 20, true);

-- Wrappers
INSERT INTO wrappers (id, material, price, is_available) VALUES
('66666666-6666-6666-6666-666666666666', 'Kraft Paper', 20.00, true),
('77777777-7777-7777-7777-777777777777', 'Satin Ribbon Wrap', 35.00, true),
('88888888-8888-8888-8888-888888888888', 'Korean Wrap', 40.00, true);

-- Wrapper Colors
INSERT INTO wrapper_colors (wrapper_id, color_name, hex_code, is_available) VALUES
('66666666-6666-6666-6666-666666666666', 'White', '#FFFFFF', true),
('66666666-6666-6666-6666-666666666666', 'Pink', '#FFC0CB', true),
('66666666-6666-6666-6666-666666666666', 'Nude', '#E3BC9A', true),
('66666666-6666-6666-6666-666666666666', 'Black', '#000000', true);

-- Fuzzy Wire Colors
INSERT INTO fuzzy_wire_colors (color_name, hex_code, display_order, is_available) VALUES
('White', '#FFFFFF', 1, true),
('Pink', '#FFC0CB', 2, true),
('Red', '#FF0000', 3, true),
('Yellow', '#FFFF00', 4, true),
('Purple', '#800080', 5, true);

-- Bouquet Sizes
INSERT INTO bouquet_sizes (key, name, stems, base_price, display_order, is_available) VALUES
('small', 'Small', '5-8 stems', 150.00, 1, true),
('medium', 'Medium', '10-15 stems', 250.00, 2, true),
('large', 'Large', '18-25 stems', 400.00, 3, true);

-- Bouquet Add-ons
INSERT INTO bouquet_addons (key, name, price, display_order, is_available) VALUES
('ribbon', 'Premium Satin Ribbon', 20.00, 1, true),
('messageCard', 'Message Card', 15.00, 2, true);

-- Bouquets
INSERT INTO bouquets (name, description, price, category, images, stock, is_featured) VALUES
('Sweet Blush Rose', 'A beautiful arrangement of pink and white roses with baby''s breath.', 350.00, 'Romantic', ARRAY['/bouquets/b1.jpg'], 0, true),
('Sunshine Sunflower', 'Bright yellow sunflowers wrapped in elegant kraft paper.', 450.00, 'Birthday', ARRAY['/bouquets/b2.jpg'], 0, true),
('Elegant Lily Dream', 'Premium lilies with eucalyptus leaves and satin ribbon.', 750.00, 'Other', ARRAY['/bouquets/b3.jpg'], 0, true),
('Grand Romance', 'A massive bouquet of red roses for that special someone.', 950.00, 'Romantic', ARRAY['/bouquets/b4.jpg'], 0, true);

-- Reviews
INSERT INTO reviews (name, message, rating, is_displayed) VALUES
('Maria Santos', 'Absolutely loved my fuzzy wire tulip bouquet! It looks so real and the best part is it won''t die.', 5, true),
('Anna Cruz', 'Perfect gift for my anniversary. The packaging was so premium.', 5, true),
('Bea Gonzalez', 'Great customizability. I picked exactly the colors I wanted.', 4, true);


-- ================================================
-- DONE! After running this, also run:
--   supabase/migrations/20260525_secure_database.sql
-- to set up RLS policies, admin_users table, and RPC functions.
--
-- Then in Supabase Auth Settings:
-- 1. Disable "Enable email confirmations" for easy setup
-- 2. The admin account will auto-create on first login
-- 3. After signup, add the user to admin_users table:
--    INSERT INTO admin_users (user_id) 
--    SELECT id FROM auth.users WHERE email = 'admin_ako@gmail.com';
-- ================================================
