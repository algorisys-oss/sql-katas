-- SQL Katas: E-Commerce Sample Dataset
-- Idempotent — safe to re-run at any time

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS product_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

-- ============================================================
-- SCHEMA
-- ============================================================

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category_id INT REFERENCES categories(id),
    price NUMERIC(10, 2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE product_tags (
    product_id INT NOT NULL REFERENCES products(id),
    tag_id INT NOT NULL REFERENCES tags(id),
    PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(200) NOT NULL UNIQUE,
    city VARCHAR(100),          -- intentionally nullable
    country VARCHAR(100) NOT NULL DEFAULT 'US',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id),
    order_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_amount NUMERIC(10, 2), -- intentionally nullable
    shipped_at TIMESTAMP,        -- intentionally nullable
    CONSTRAINT valid_status CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled'))
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id),
    product_id INT NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL
);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Categories (10)
INSERT INTO categories (name, description) VALUES
    ('Electronics', 'Devices, gadgets, and accessories'),
    ('Clothing', 'Apparel and fashion items'),
    ('Books', 'Physical and digital books'),
    ('Home & Kitchen', 'Furniture, appliances, and cookware'),
    ('Sports & Outdoors', 'Athletic gear and outdoor equipment'),
    ('Toys & Games', 'Games, puzzles, and toys for all ages'),
    ('Health & Beauty', 'Personal care and wellness products'),
    ('Automotive', 'Car parts and accessories'),
    ('Music', 'Instruments and audio equipment'),
    ('Office Supplies', 'Stationery and office equipment');

-- Products (30)
INSERT INTO products (name, category_id, price, stock_quantity, created_at) VALUES
    ('Wireless Bluetooth Headphones', 1, 79.99, 150, '2024-01-15'),
    ('USB-C Charging Cable 3-Pack', 1, 14.99, 500, '2024-01-20'),
    ('Mechanical Keyboard', 1, 129.99, 75, '2024-02-01'),
    ('27-inch 4K Monitor', 1, 449.99, 30, '2024-02-10'),
    ('Portable Power Bank 20000mAh', 1, 39.99, 200, '2024-03-05'),
    ('Cotton Crew Neck T-Shirt', 2, 24.99, 300, '2024-01-10'),
    ('Slim Fit Jeans', 2, 59.99, 180, '2024-01-25'),
    ('Running Shoes', 2, 89.99, 120, '2024-02-15'),
    ('Winter Parka Jacket', 2, 149.99, 45, '2024-03-01'),
    ('Wool Beanie Hat', 2, 19.99, 250, '2024-03-10'),
    ('SQL Performance Explained', 3, 34.99, 90, '2024-01-05'),
    ('Designing Data-Intensive Applications', 3, 42.99, 60, '2024-01-12'),
    ('The Art of PostgreSQL', 3, 49.99, 40, '2024-02-20'),
    ('Clean Code', 3, 37.99, 110, '2024-03-15'),
    ('Database Internals', 3, 54.99, 35, '2024-04-01'),
    ('Stainless Steel Cookware Set', 4, 199.99, 25, '2024-02-01'),
    ('Robot Vacuum Cleaner', 4, 299.99, 50, '2024-02-20'),
    ('Memory Foam Pillow', 4, 49.99, 180, '2024-03-10'),
    ('Cast Iron Skillet 12-inch', 4, 44.99, 90, '2024-03-25'),
    ('Smart LED Bulbs 4-Pack', 4, 29.99, 220, '2024-04-05'),
    ('Yoga Mat Premium', 5, 34.99, 160, '2024-01-20'),
    ('Adjustable Dumbbells Set', 5, 249.99, 40, '2024-02-10'),
    ('Camping Tent 4-Person', 5, 179.99, 35, '2024-03-01'),
    ('Hiking Backpack 40L', 5, 79.99, 70, '2024-03-20'),
    ('Strategy Board Game Collection', 6, 44.99, 85, '2024-02-05'),
    ('1000-Piece Jigsaw Puzzle', 6, 19.99, 140, '2024-02-25'),
    ('Vitamin D Supplements 90ct', 7, 14.99, 300, '2024-01-15'),
    ('Electric Toothbrush', 7, 69.99, 95, '2024-03-05'),
    ('Acoustic Guitar Beginner Pack', 9, 159.99, 30, '2024-02-15'),
    ('Ergonomic Office Chair', 10, 349.99, 20, '2024-01-30');

-- Tags (15)
INSERT INTO tags (name) VALUES
    ('bestseller'),
    ('new-arrival'),
    ('on-sale'),
    ('eco-friendly'),
    ('premium'),
    ('budget-friendly'),
    ('trending'),
    ('limited-edition'),
    ('staff-pick'),
    ('gift-idea'),
    ('back-in-stock'),
    ('clearance'),
    ('seasonal'),
    ('exclusive'),
    ('bundle-deal');

-- Product Tags (~60 assignments)
INSERT INTO product_tags (product_id, tag_id) VALUES
    (1, 1), (1, 7), (1, 10),          -- headphones: bestseller, trending, gift-idea
    (2, 6), (2, 1),                     -- usb cable: budget-friendly, bestseller
    (3, 5), (3, 9), (3, 7),            -- keyboard: premium, staff-pick, trending
    (4, 5), (4, 2),                     -- monitor: premium, new-arrival
    (5, 1), (5, 6), (5, 10),           -- power bank: bestseller, budget-friendly, gift-idea
    (6, 6), (6, 4),                     -- t-shirt: budget-friendly, eco-friendly
    (7, 7), (7, 1),                     -- jeans: trending, bestseller
    (8, 1), (8, 7),                     -- running shoes: bestseller, trending
    (9, 13), (9, 5),                    -- parka: seasonal, premium
    (10, 6), (10, 13),                  -- beanie: budget-friendly, seasonal
    (11, 9), (11, 1),                   -- sql book: staff-pick, bestseller
    (12, 9), (12, 5),                   -- ddia book: staff-pick, premium
    (13, 9), (13, 14),                  -- postgres book: staff-pick, exclusive
    (14, 1), (14, 10),                  -- clean code: bestseller, gift-idea
    (15, 2), (15, 5),                   -- db internals: new-arrival, premium
    (16, 5), (16, 15),                  -- cookware: premium, bundle-deal
    (17, 7), (17, 2),                   -- vacuum: trending, new-arrival
    (18, 1), (18, 6),                   -- pillow: bestseller, budget-friendly
    (19, 9), (19, 4),                   -- skillet: staff-pick, eco-friendly
    (20, 6), (20, 4),                   -- led bulbs: budget-friendly, eco-friendly
    (21, 1), (21, 4),                   -- yoga mat: bestseller, eco-friendly
    (22, 5), (22, 8),                   -- dumbbells: premium, limited-edition
    (23, 13), (23, 2),                  -- tent: seasonal, new-arrival
    (24, 9), (24, 7),                   -- backpack: staff-pick, trending
    (25, 10), (25, 9),                  -- board game: gift-idea, staff-pick
    (26, 6), (26, 10),                  -- puzzle: budget-friendly, gift-idea
    (27, 1), (27, 6),                   -- vitamins: bestseller, budget-friendly
    (28, 7), (28, 2),                   -- toothbrush: trending, new-arrival
    (29, 10), (29, 2),                  -- guitar: gift-idea, new-arrival
    (30, 5), (30, 9);                   -- office chair: premium, staff-pick

-- Customers (20) — some with NULL city
INSERT INTO customers (first_name, last_name, email, city, country, created_at) VALUES
    ('Alice', 'Johnson', 'alice.johnson@example.com', 'Seattle', 'US', '2024-01-05'),
    ('Bob', 'Smith', 'bob.smith@example.com', 'Portland', 'US', '2024-01-10'),
    ('Carol', 'Williams', 'carol.williams@example.com', NULL, 'US', '2024-01-15'),
    ('David', 'Brown', 'david.brown@example.com', 'Austin', 'US', '2024-01-20'),
    ('Eva', 'Martinez', 'eva.martinez@example.com', 'Denver', 'US', '2024-02-01'),
    ('Frank', 'Garcia', 'frank.garcia@example.com', NULL, 'US', '2024-02-10'),
    ('Grace', 'Lee', 'grace.lee@example.com', 'San Francisco', 'US', '2024-02-15'),
    ('Henry', 'Wilson', 'henry.wilson@example.com', 'Chicago', 'US', '2024-02-20'),
    ('Iris', 'Anderson', 'iris.anderson@example.com', 'New York', 'US', '2024-03-01'),
    ('Jack', 'Thomas', 'jack.thomas@example.com', NULL, 'US', '2024-03-10'),
    ('Karen', 'Taylor', 'karen.taylor@example.com', 'Boston', 'US', '2024-03-15'),
    ('Leo', 'Moore', 'leo.moore@example.com', 'Miami', 'US', '2024-03-20'),
    ('Mia', 'Jackson', 'mia.jackson@example.com', 'London', 'UK', '2024-04-01'),
    ('Noah', 'White', 'noah.white@example.com', NULL, 'UK', '2024-04-10'),
    ('Olivia', 'Harris', 'olivia.harris@example.com', 'Toronto', 'CA', '2024-04-15'),
    ('Peter', 'Clark', 'peter.clark@example.com', 'Vancouver', 'CA', '2024-04-20'),
    ('Quinn', 'Lewis', 'quinn.lewis@example.com', NULL, 'AU', '2024-05-01'),
    ('Rachel', 'Young', 'rachel.young@example.com', 'Sydney', 'AU', '2024-05-10'),
    ('Sam', 'Hall', 'sam.hall@example.com', 'Berlin', 'DE', '2024-05-15'),
    ('Tina', 'Allen', 'tina.allen@example.com', NULL, 'DE', '2024-05-20');

-- Orders (50) — some with NULL total_amount and shipped_at
INSERT INTO orders (customer_id, order_date, status, total_amount, shipped_at) VALUES
    (1, '2024-02-01', 'delivered', 94.98, '2024-02-03 10:00:00'),
    (1, '2024-03-15', 'delivered', 449.99, '2024-03-17 14:30:00'),
    (2, '2024-02-10', 'delivered', 59.98, '2024-02-12 09:15:00'),
    (2, '2024-04-20', 'shipped', 129.99, '2024-04-22 11:00:00'),
    (3, '2024-02-15', 'delivered', NULL, '2024-02-17 16:45:00'),
    (3, '2024-05-01', 'confirmed', 79.99, NULL),
    (4, '2024-02-20', 'delivered', 84.98, '2024-02-22 08:30:00'),
    (4, '2024-04-10', 'delivered', 199.99, '2024-04-12 13:00:00'),
    (5, '2024-03-01', 'delivered', 34.99, '2024-03-03 10:45:00'),
    (5, '2024-05-15', 'pending', NULL, NULL),
    (6, '2024-03-10', 'cancelled', 299.99, NULL),
    (6, '2024-05-20', 'confirmed', 44.99, NULL),
    (7, '2024-03-15', 'delivered', 179.97, '2024-03-17 09:00:00'),
    (7, '2024-04-25', 'delivered', 89.99, '2024-04-27 14:15:00'),
    (7, '2024-06-01', 'shipped', 42.99, '2024-06-03 10:30:00'),
    (8, '2024-03-20', 'delivered', 249.99, '2024-03-22 11:30:00'),
    (8, '2024-05-10', 'delivered', 69.99, '2024-05-12 08:45:00'),
    (9, '2024-04-01', 'delivered', 154.98, '2024-04-03 15:00:00'),
    (9, '2024-05-25', 'shipped', NULL, '2024-05-27 09:30:00'),
    (10, '2024-04-05', 'delivered', 39.99, '2024-04-07 12:00:00'),
    (10, '2024-06-10', 'pending', 79.99, NULL),
    (11, '2024-04-10', 'delivered', 349.99, '2024-04-12 10:15:00'),
    (11, '2024-05-30', 'delivered', 34.99, '2024-06-01 14:00:00'),
    (12, '2024-04-15', 'delivered', 109.98, '2024-04-17 11:45:00'),
    (12, '2024-06-05', 'confirmed', 159.99, NULL),
    (13, '2024-04-20', 'delivered', 92.98, '2024-04-22 09:30:00'),
    (13, '2024-06-15', 'shipped', 49.99, '2024-06-17 13:00:00'),
    (14, '2024-04-25', 'cancelled', NULL, NULL),
    (14, '2024-06-20', 'pending', 24.99, NULL),
    (15, '2024-05-01', 'delivered', 229.98, '2024-05-03 10:00:00'),
    (15, '2024-06-25', 'confirmed', 44.99, NULL),
    (16, '2024-05-05', 'delivered', 54.98, '2024-05-07 15:30:00'),
    (16, '2024-07-01', 'shipped', 79.99, '2024-07-03 09:00:00'),
    (17, '2024-05-10', 'delivered', 14.99, '2024-05-12 11:15:00'),
    (17, '2024-07-05', 'pending', NULL, NULL),
    (18, '2024-05-15', 'delivered', 179.99, '2024-05-17 14:00:00'),
    (18, '2024-07-10', 'delivered', 37.99, '2024-07-12 08:30:00'),
    (19, '2024-05-20', 'delivered', 129.99, '2024-05-22 10:45:00'),
    (19, '2024-07-15', 'shipped', 29.99, '2024-07-17 12:00:00'),
    (20, '2024-05-25', 'delivered', 89.99, '2024-05-27 09:15:00'),
    (20, '2024-07-20', 'confirmed', NULL, NULL),
    (1, '2024-06-01', 'delivered', 64.98, '2024-06-03 11:30:00'),
    (3, '2024-06-15', 'shipped', 34.99, '2024-06-17 14:45:00'),
    (5, '2024-07-01', 'delivered', 149.99, '2024-07-03 10:00:00'),
    (7, '2024-07-10', 'pending', 19.99, NULL),
    (9, '2024-07-20', 'delivered', 44.99, '2024-07-22 09:30:00'),
    (11, '2024-08-01', 'confirmed', 79.99, NULL),
    (13, '2024-08-10', 'shipped', 54.99, '2024-08-12 13:15:00'),
    (15, '2024-08-15', 'delivered', 299.99, '2024-08-17 10:00:00'),
    (2, '2024-08-20', 'pending', 14.99, NULL);

-- Order Items (~100)
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
    (1, 1, 1, 79.99),   (1, 2, 1, 14.99),
    (2, 4, 1, 449.99),
    (3, 6, 1, 24.99),   (3, 10, 1, 19.99),  (3, 2, 1, 14.99),
    (4, 3, 1, 129.99),
    (5, 1, 1, 79.99),
    (6, 1, 1, 79.99),
    (7, 11, 1, 34.99),  (7, 13, 1, 49.99),
    (8, 16, 1, 199.99),
    (9, 21, 1, 34.99),
    (10, 5, 1, 39.99),  (10, 2, 1, 14.99),
    (11, 17, 1, 299.99),
    (12, 25, 1, 44.99),
    (13, 8, 1, 89.99),  (13, 6, 1, 24.99),  (13, 27, 2, 14.99),
    (14, 8, 1, 89.99),
    (15, 12, 1, 42.99),
    (16, 22, 1, 249.99),
    (17, 28, 1, 69.99),
    (18, 14, 1, 37.99),  (18, 11, 1, 34.99),  (18, 15, 1, 54.99),  (18, 27, 1, 14.99),
    (19, 24, 1, 79.99),
    (20, 5, 1, 39.99),
    (21, 24, 1, 79.99),
    (22, 30, 1, 349.99),
    (23, 21, 1, 34.99),
    (24, 7, 1, 59.99),   (24, 13, 1, 49.99),
    (25, 29, 1, 159.99),
    (26, 12, 1, 42.99),  (26, 18, 1, 49.99),
    (27, 13, 1, 49.99),
    (28, 9, 1, 149.99),
    (29, 6, 1, 24.99),
    (30, 4, 1, 449.99),  (30, 3, 1, 129.99),
    (31, 19, 1, 44.99),
    (32, 15, 1, 54.99),
    (33, 24, 1, 79.99),
    (34, 2, 1, 14.99),
    (35, 5, 2, 39.99),
    (36, 23, 1, 179.99),
    (37, 14, 1, 37.99),
    (38, 3, 1, 129.99),
    (39, 20, 1, 29.99),
    (40, 8, 1, 89.99),
    (41, 11, 1, 34.99),  (41, 20, 1, 29.99),
    (42, 21, 1, 34.99),
    (43, 10, 1, 19.99),  (43, 2, 1, 14.99),
    (44, 9, 1, 149.99),
    (45, 26, 1, 19.99),
    (46, 25, 1, 44.99),
    (47, 24, 1, 79.99),
    (48, 15, 1, 54.99),
    (49, 17, 1, 299.99),
    (50, 2, 1, 14.99);

-- ============================================================
-- LEARNER ROLE (read-only access)
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'sql_katas_learner') THEN
        CREATE ROLE sql_katas_learner WITH LOGIN PASSWORD 'learner';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE sql_katas TO sql_katas_learner;
GRANT USAGE ON SCHEMA public TO sql_katas_learner;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO sql_katas_learner;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO sql_katas_learner;
