-- Astraea Collection Supabase Schema

-- 1. bouquets
CREATE TABLE bouquets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category TEXT,
    images TEXT[],
    is_visible BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. flowers
CREATE TABLE flowers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price_per_stem DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. flower_colors
CREATE TABLE flower_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flower_id UUID REFERENCES flowers(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    hex_code TEXT,
    is_available BOOLEAN DEFAULT true
);

-- 4. fillers
CREATE TABLE fillers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    is_available BOOLEAN DEFAULT true
);

-- 5. wrappers
CREATE TABLE wrappers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL
);

-- 6. wrapper_colors
CREATE TABLE wrapper_colors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wrapper_id UUID REFERENCES wrappers(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    hex_code TEXT,
    is_available BOOLEAN DEFAULT true
);

-- 7. orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    email TEXT,
    order_type TEXT NOT NULL, -- 'ready-made' or 'custom'
    delivery_method TEXT NOT NULL, -- 'pickup' or 'delivery'
    delivery_address TEXT,
    preferred_date DATE,
    preferred_time TEXT,
    special_notes TEXT,
    total_amount DECIMAL(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, being-made, ready, completed, cancelled
    is_paid BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. order_items
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- 'bouquet' or 'custom'
    bouquet_id UUID REFERENCES bouquets(id),
    size TEXT,
    flowers JSONB,
    fillers JSONB,
    wrapper JSONB,
    addons JSONB,
    message_card TEXT,
    quantity INTEGER DEFAULT 1,
    subtotal DECIMAL(10, 2) NOT NULL
);

-- 9. reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    message TEXT,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. settings
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL
);


-- ==============================
-- SEED DATA
-- ==============================

-- Seed Flowers
INSERT INTO flowers (id, name, price_per_stem) VALUES
('11111111-1111-1111-1111-111111111111', 'Rose', 50.00),
('22222222-2222-2222-2222-222222222222', 'Tulip', 60.00),
('33333333-3333-3333-3333-333333333333', 'Sunflower', 80.00),
('44444444-4444-4444-4444-444444444444', 'Daisy', 40.00),
('55555555-5555-5555-5555-555555555555', 'Lily', 70.00);

-- Seed Flower Colors (For all flowers generically or specifically)
INSERT INTO flower_colors (flower_id, color_name, hex_code, is_available) VALUES
('11111111-1111-1111-1111-111111111111', 'Red', '#FF0000', true),
('11111111-1111-1111-1111-111111111111', 'Pink', '#FFC0CB', true),
('11111111-1111-1111-1111-111111111111', 'White', '#FFFFFF', true),
('11111111-1111-1111-1111-111111111111', 'Yellow', '#FFFF00', true),
('11111111-1111-1111-1111-111111111111', 'Purple', '#800080', false),
('11111111-1111-1111-1111-111111111111', 'Peach', '#FFDAB9', false);

-- Seed Fillers
INSERT INTO fillers (name, price, is_available) VALUES
('Baby''s Breath', 30.00, true),
('Eucalyptus Leaves', 25.00, true),
('Fern', 20.00, true);

-- Seed Wrappers
INSERT INTO wrappers (id, material, price) VALUES
('66666666-6666-6666-6666-666666666666', 'Kraft Paper', 20.00),
('77777777-7777-7777-7777-777777777777', 'Satin Ribbon Wrap', 35.00),
('88888888-8888-8888-8888-888888888888', 'Korean Wrap', 40.00);

-- Seed Wrapper Colors
INSERT INTO wrapper_colors (wrapper_id, color_name, hex_code, is_available) VALUES
('66666666-6666-6666-6666-666666666666', 'White', '#FFFFFF', true),
('66666666-6666-6666-6666-666666666666', 'Pink', '#FFC0CB', true),
('66666666-6666-6666-6666-666666666666', 'Nude', '#E3BC9A', true),
('66666666-6666-6666-6666-666666666666', 'Black', '#000000', true);

-- Seed Ready-made Bouquets
INSERT INTO bouquets (name, description, price, category, images, is_featured) VALUES
('Sweet Blush Rose', 'A beautiful arrangement of pink and white roses with baby''s breath.', 350.00, 'Rose', ARRAY['/bouquets/b1.jpg'], true),
('Sunshine Sunflower', 'Bright yellow sunflowers wrapped in elegant kraft paper.', 450.00, 'Sunflower', ARRAY['/bouquets/b2.jpg'], true),
('Elegant Lily Dream', 'Premium lilies with eucalyptus leaves and satin ribbon.', 750.00, 'Lily', ARRAY['/bouquets/b3.jpg'], true),
('Grand Romance', 'A massive bouquet of red roses for that special someone.', 950.00, 'Rose', ARRAY['/bouquets/b4.jpg'], true);

-- Seed Reviews
INSERT INTO reviews (customer_name, message, rating) VALUES
('Maria Santos', 'Absolutely loved my fuzzy wire tulip bouquet! It looks so real and the best part is it won''t die.', 5),
('Anna Cruz', 'Perfect gift for my anniversary. The packaging was so premium.', 5),
('Bea Gonzalez', 'Great customizability. I picked exactly the colors I wanted.', 4);

-- Admin Auth (Note): 
-- Admin credentials admin@astraea.com / astraea2024 should be created directly via Supabase Auth Dashboard.
