-- ═══════════════════════════════════════════════════════
-- eCommerce — Sample / Seed Data
-- Run AFTER 01_schema.sql
-- Passwords: bcrypt hash of "password123"
-- ═══════════════════════════════════════════════════════

USE ecommerce;

-- ─── USERS ──────────────────────────────────────────────
-- Password for all users: password123
-- Hash generated with bcryptjs, 10 rounds

INSERT INTO users (id, email, password_hash, name, phone, role) VALUES
('u-admin-001', 'admin@ecommerce.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Admin Principal', '+34 600 000 001', 'ADMIN'),
('u-manager-001', 'gestor@ecommerce.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Gestor de Pedidos', '+34 600 000 002', 'ORDER_MANAGER'),
('u-customer-001', 'cliente1@email.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'María García López', '+34 600 100 001', 'CUSTOMER'),
('u-customer-002', 'cliente2@email.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Carlos Martínez Ruiz', '+34 600 100 002', 'CUSTOMER'),
('u-customer-003', 'cliente3@email.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Laura Sánchez Pérez', '+34 600 100 003', 'CUSTOMER');

-- ─── ADDRESSES ──────────────────────────────────────────

INSERT INTO addresses (id, user_id, first_name, last_name, address1, city, state, postal_code, country, phone, is_default) VALUES
('addr-001', 'u-customer-001', 'María', 'García López', 'Calle Gran Vía 42, 3ºA', 'Madrid', 'Madrid', '28013', 'ES', '+34 600 100 001', 1),
('addr-002', 'u-customer-002', 'Carlos', 'Martínez Ruiz', 'Avda. Diagonal 520', 'Barcelona', 'Barcelona', '08006', 'ES', '+34 600 100 002', 1),
('addr-003', 'u-customer-003', 'Laura', 'Sánchez Pérez', 'Calle Sierpes 15', 'Sevilla', 'Sevilla', '41004', 'ES', '+34 600 100 003', 1);

-- ─── CATEGORIES ─────────────────────────────────────────

INSERT INTO categories (id, slug, parent_id, sort_order, is_active) VALUES
('cat-electronics', 'electronics', NULL, 1, 1),
('cat-phones', 'phones', 'cat-electronics', 1, 1),
('cat-laptops', 'laptops', 'cat-electronics', 2, 1),
('cat-audio', 'audio', 'cat-electronics', 3, 1),
('cat-fashion', 'fashion', NULL, 2, 1),
('cat-men', 'men', 'cat-fashion', 1, 1),
('cat-women', 'women', 'cat-fashion', 2, 1),
('cat-home', 'home-garden', NULL, 3, 1),
('cat-sports', 'sports', NULL, 4, 1);

INSERT INTO category_translations (id, category_id, locale, name, description, meta_title, meta_description) VALUES
('ct-elec-es', 'cat-electronics', 'es', 'Electrónica', 'Los mejores productos de electrónica y tecnología', 'Electrónica — eShop', 'Compra los mejores productos de electrónica'),
('ct-elec-en', 'cat-electronics', 'en', 'Electronics', 'The best electronics and technology products', 'Electronics — eShop', 'Shop the best electronics products'),
('ct-phones-es', 'cat-phones', 'es', 'Smartphones', 'Teléfonos móviles de última generación', NULL, NULL),
('ct-phones-en', 'cat-phones', 'en', 'Smartphones', 'Latest generation mobile phones', NULL, NULL),
('ct-laptops-es', 'cat-laptops', 'es', 'Portátiles', 'Ordenadores portátiles para trabajo y gaming', NULL, NULL),
('ct-laptops-en', 'cat-laptops', 'en', 'Laptops', 'Laptops for work and gaming', NULL, NULL),
('ct-audio-es', 'cat-audio', 'es', 'Audio', 'Auriculares, altavoces y más', NULL, NULL),
('ct-audio-en', 'cat-audio', 'en', 'Audio', 'Headphones, speakers and more', NULL, NULL),
('ct-fashion-es', 'cat-fashion', 'es', 'Moda', 'Ropa y accesorios de moda', 'Moda — eShop', 'Descubre las últimas tendencias'),
('ct-fashion-en', 'cat-fashion', 'en', 'Fashion', 'Clothing and fashion accessories', 'Fashion — eShop', 'Discover the latest trends'),
('ct-men-es', 'cat-men', 'es', 'Hombre', 'Moda para hombre', NULL, NULL),
('ct-men-en', 'cat-men', 'en', 'Men', 'Men fashion', NULL, NULL),
('ct-women-es', 'cat-women', 'es', 'Mujer', 'Moda para mujer', NULL, NULL),
('ct-women-en', 'cat-women', 'en', 'Women', 'Women fashion', NULL, NULL),
('ct-home-es', 'cat-home', 'es', 'Hogar y Jardín', 'Todo para tu hogar', 'Hogar — eShop', 'Productos para tu hogar'),
('ct-home-en', 'cat-home', 'en', 'Home & Garden', 'Everything for your home', 'Home — eShop', 'Products for your home'),
('ct-sports-es', 'cat-sports', 'es', 'Deportes', 'Equipamiento deportivo', 'Deportes — eShop', 'Equipamiento deportivo de calidad'),
('ct-sports-en', 'cat-sports', 'en', 'Sports', 'Sports equipment', 'Sports — eShop', 'Quality sports equipment');

-- ─── VARIANT TYPES ──────────────────────────────────────

INSERT INTO variant_types (id, slug) VALUES
('vt-size', 'size'),
('vt-color', 'color'),
('vt-storage', 'storage');

INSERT INTO variant_type_translations (id, variant_type_id, locale, name) VALUES
('vtt-size-es', 'vt-size', 'es', 'Talla'),
('vtt-size-en', 'vt-size', 'en', 'Size'),
('vtt-color-es', 'vt-color', 'es', 'Color'),
('vtt-color-en', 'vt-color', 'en', 'Color'),
('vtt-storage-es', 'vt-storage', 'es', 'Almacenamiento'),
('vtt-storage-en', 'vt-storage', 'en', 'Storage');

INSERT INTO variant_options (id, variant_type_id, slug, sort_order) VALUES
('vo-s', 'vt-size', 's', 1), ('vo-m', 'vt-size', 'm', 2), ('vo-l', 'vt-size', 'l', 3), ('vo-xl', 'vt-size', 'xl', 4),
('vo-black', 'vt-color', 'black', 1), ('vo-white', 'vt-color', 'white', 2), ('vo-blue', 'vt-color', 'blue', 3), ('vo-red', 'vt-color', 'red', 4),
('vo-128gb', 'vt-storage', '128gb', 1), ('vo-256gb', 'vt-storage', '256gb', 2), ('vo-512gb', 'vt-storage', '512gb', 3);

INSERT INTO variant_option_translations (id, variant_option_id, locale, value) VALUES
('vot-s-es', 'vo-s', 'es', 'S'), ('vot-s-en', 'vo-s', 'en', 'S'),
('vot-m-es', 'vo-m', 'es', 'M'), ('vot-m-en', 'vo-m', 'en', 'M'),
('vot-l-es', 'vo-l', 'es', 'L'), ('vot-l-en', 'vo-l', 'en', 'L'),
('vot-xl-es', 'vo-xl', 'es', 'XL'), ('vot-xl-en', 'vo-xl', 'en', 'XL'),
('vot-black-es', 'vo-black', 'es', 'Negro'), ('vot-black-en', 'vo-black', 'en', 'Black'),
('vot-white-es', 'vo-white', 'es', 'Blanco'), ('vot-white-en', 'vo-white', 'en', 'White'),
('vot-blue-es', 'vo-blue', 'es', 'Azul'), ('vot-blue-en', 'vo-blue', 'en', 'Blue'),
('vot-red-es', 'vo-red', 'es', 'Rojo'), ('vot-red-en', 'vo-red', 'en', 'Red'),
('vot-128-es', 'vo-128gb', 'es', '128 GB'), ('vot-128-en', 'vo-128gb', 'en', '128 GB'),
('vot-256-es', 'vo-256gb', 'es', '256 GB'), ('vot-256-en', 'vo-256gb', 'en', '256 GB'),
('vot-512-es', 'vo-512gb', 'es', '512 GB'), ('vot-512-en', 'vo-512gb', 'en', '512 GB');

-- ─── PRODUCTS ───────────────────────────────────────────

INSERT INTO products (id, slug, sku, price, compare_at_price, is_active, is_featured) VALUES
('p-001', 'auriculares-premium-wireless', 'AUR-PRE-001', 149.99, 199.99, 1, 1),
('p-002', 'smartphone-pro-max', 'PHONE-PRO-001', 999.99, NULL, 1, 1),
('p-003', 'portatil-ultrabook-14', 'LAP-ULT-001', 1299.99, 1499.99, 1, 1),
('p-004', 'camiseta-algodon-premium', 'CAM-ALG-001', 39.99, NULL, 1, 0),
('p-005', 'zapatillas-running-pro', 'ZAP-RUN-001', 129.99, 159.99, 1, 1),
('p-006', 'altavoz-bluetooth-portatil', 'ALT-BLU-001', 79.99, NULL, 1, 0),
('p-007', 'reloj-minimalista-acero', 'REL-MIN-001', 249.99, 299.99, 1, 1),
('p-008', 'mochila-urban-resistente', 'MOC-URB-001', 69.99, NULL, 1, 0);

INSERT INTO product_translations (id, product_id, locale, name, short_description, description, meta_title, meta_description) VALUES
('pt-001-es', 'p-001', 'es', 'Auriculares Premium Wireless', 'Auriculares inalámbricos con cancelación de ruido activa', '<h2>Auriculares Premium Wireless</h2><p>Experimenta un sonido excepcional con nuestros auriculares premium. Con cancelación de ruido activa, 30 horas de batería y un diseño ergonómico ultra cómodo.</p><ul><li>Cancelación de ruido activa</li><li>30h de batería</li><li>Bluetooth 5.3</li><li>Micrófono integrado</li></ul>', 'Auriculares Premium Wireless — eShop', 'Auriculares inalámbricos con cancelación de ruido, 30h batería'),
('pt-001-en', 'p-001', 'en', 'Premium Wireless Headphones', 'Wireless headphones with active noise cancellation', '<h2>Premium Wireless Headphones</h2><p>Experience exceptional sound with our premium headphones. Featuring active noise cancellation, 30-hour battery life and ultra-comfortable ergonomic design.</p><ul><li>Active noise cancellation</li><li>30h battery</li><li>Bluetooth 5.3</li><li>Built-in microphone</li></ul>', 'Premium Wireless Headphones — eShop', 'Wireless headphones with noise cancellation, 30h battery'),
('pt-002-es', 'p-002', 'es', 'Smartphone Pro Max', 'El smartphone más potente del mercado', '<h2>Smartphone Pro Max</h2><p>Pantalla AMOLED 6.7", procesador de última generación, cámara de 200MP y batería de 5000mAh.</p>', 'Smartphone Pro Max — eShop', 'Smartphone de gama alta con cámara 200MP'),
('pt-002-en', 'p-002', 'en', 'Smartphone Pro Max', 'The most powerful smartphone on the market', '<h2>Smartphone Pro Max</h2><p>6.7" AMOLED display, latest generation processor, 200MP camera and 5000mAh battery.</p>', 'Smartphone Pro Max — eShop', 'High-end smartphone with 200MP camera'),
('pt-003-es', 'p-003', 'es', 'Portátil Ultrabook 14"', 'Ultrabook potente y ligero para profesionales', '<h2>Portátil Ultrabook 14"</h2><p>Pantalla 2K, 16GB RAM, SSD 512GB, solo 1.2kg de peso.</p>', 'Portátil Ultrabook 14" — eShop', 'Portátil ultraligero para profesionales'),
('pt-003-en', 'p-003', 'en', 'Ultrabook Laptop 14"', 'Powerful and lightweight ultrabook for professionals', '<h2>Ultrabook Laptop 14"</h2><p>2K display, 16GB RAM, 512GB SSD, only 1.2kg weight.</p>', 'Ultrabook Laptop 14" — eShop', 'Ultra-lightweight laptop for professionals'),
('pt-004-es', 'p-004', 'es', 'Camiseta Algodón Premium', 'Camiseta 100% algodón orgánico', '<h2>Camiseta Algodón Premium</h2><p>Confeccionada con algodón orgánico certificado. Corte regular, suave al tacto.</p>', NULL, NULL),
('pt-004-en', 'p-004', 'en', 'Premium Cotton T-Shirt', '100% organic cotton t-shirt', '<h2>Premium Cotton T-Shirt</h2><p>Made with certified organic cotton. Regular fit, soft to the touch.</p>', NULL, NULL),
('pt-005-es', 'p-005', 'es', 'Zapatillas Running Pro', 'Zapatillas de running con amortiguación avanzada', '<h2>Zapatillas Running Pro</h2><p>Tecnología de amortiguación avanzada, suela de caucho antideslizante, malla transpirable.</p>', NULL, NULL),
('pt-005-en', 'p-005', 'en', 'Pro Running Shoes', 'Running shoes with advanced cushioning', '<h2>Pro Running Shoes</h2><p>Advanced cushioning technology, non-slip rubber sole, breathable mesh.</p>', NULL, NULL),
('pt-006-es', 'p-006', 'es', 'Altavoz Bluetooth Portátil', 'Altavoz resistente al agua con sonido 360°', '<h2>Altavoz Bluetooth Portátil</h2><p>IPX7, 20h batería, sonido 360 grados potente y claro.</p>', NULL, NULL),
('pt-006-en', 'p-006', 'en', 'Portable Bluetooth Speaker', 'Waterproof speaker with 360° sound', '<h2>Portable Bluetooth Speaker</h2><p>IPX7, 20h battery, powerful and clear 360-degree sound.</p>', NULL, NULL),
('pt-007-es', 'p-007', 'es', 'Reloj Minimalista Acero', 'Reloj de acero inoxidable con diseño minimalista', '<h2>Reloj Minimalista Acero</h2><p>Caja de 40mm en acero inoxidable, cristal de zafiro, resistente al agua 50m.</p>', NULL, NULL),
('pt-007-en', 'p-007', 'en', 'Minimalist Steel Watch', 'Stainless steel watch with minimalist design', '<h2>Minimalist Steel Watch</h2><p>40mm stainless steel case, sapphire crystal, 50m water resistant.</p>', NULL, NULL),
('pt-008-es', 'p-008', 'es', 'Mochila Urban Resistente', 'Mochila urbana con compartimento para portátil', '<h2>Mochila Urban</h2><p>Material resistente al agua, compartimento acolchado para portátil 15", múltiples bolsillos.</p>', NULL, NULL),
('pt-008-en', 'p-008', 'en', 'Urban Resistant Backpack', 'Urban backpack with laptop compartment', '<h2>Urban Backpack</h2><p>Water-resistant material, padded 15" laptop compartment, multiple pockets.</p>', NULL, NULL);

-- Product ↔ Category associations
INSERT INTO product_categories (product_id, category_id) VALUES
('p-001', 'cat-electronics'), ('p-001', 'cat-audio'),
('p-002', 'cat-electronics'), ('p-002', 'cat-phones'),
('p-003', 'cat-electronics'), ('p-003', 'cat-laptops'),
('p-004', 'cat-fashion'), ('p-004', 'cat-men'),
('p-005', 'cat-sports'),
('p-006', 'cat-electronics'), ('p-006', 'cat-audio'),
('p-007', 'cat-fashion'),
('p-008', 'cat-sports');

-- ─── PRODUCT VARIANTS ───────────────────────────────────

-- Auriculares: colores
INSERT INTO product_variants (id, product_id, sku, price, stock, weight) VALUES
('pv-001-black', 'p-001', 'AUR-PRE-001-BLK', NULL, 50, 0.28),
('pv-001-white', 'p-001', 'AUR-PRE-001-WHT', NULL, 35, 0.28);

INSERT INTO product_variant_options (variant_id, variant_option_id) VALUES
('pv-001-black', 'vo-black'), ('pv-001-white', 'vo-white');

-- Smartphone: storage + color
INSERT INTO product_variants (id, product_id, sku, price, stock, weight) VALUES
('pv-002-128-blk', 'p-002', 'PHONE-PRO-128-BLK', 999.99, 20, 0.21),
('pv-002-256-blk', 'p-002', 'PHONE-PRO-256-BLK', 1099.99, 15, 0.21),
('pv-002-256-wht', 'p-002', 'PHONE-PRO-256-WHT', 1099.99, 12, 0.21);

INSERT INTO product_variant_options (variant_id, variant_option_id) VALUES
('pv-002-128-blk', 'vo-128gb'), ('pv-002-128-blk', 'vo-black'),
('pv-002-256-blk', 'vo-256gb'), ('pv-002-256-blk', 'vo-black'),
('pv-002-256-wht', 'vo-256gb'), ('pv-002-256-wht', 'vo-white');

-- Camiseta: tallas + colores
INSERT INTO product_variants (id, product_id, sku, price, stock, weight) VALUES
('pv-004-s-blk', 'p-004', 'CAM-ALG-S-BLK', NULL, 100, 0.18),
('pv-004-m-blk', 'p-004', 'CAM-ALG-M-BLK', NULL, 80, 0.20),
('pv-004-l-wht', 'p-004', 'CAM-ALG-L-WHT', NULL, 60, 0.22),
('pv-004-xl-blue', 'p-004', 'CAM-ALG-XL-BLU', NULL, 40, 0.24);

INSERT INTO product_variant_options (variant_id, variant_option_id) VALUES
('pv-004-s-blk', 'vo-s'), ('pv-004-s-blk', 'vo-black'),
('pv-004-m-blk', 'vo-m'), ('pv-004-m-blk', 'vo-black'),
('pv-004-l-wht', 'vo-l'), ('pv-004-l-wht', 'vo-white'),
('pv-004-xl-blue', 'vo-xl'), ('pv-004-xl-blue', 'vo-blue');

-- ─── PRODUCT IMAGES (placeholder URLs) ──────────────────

INSERT INTO product_images (id, product_id, url, alt, sort_order) VALUES
('img-001-1', 'p-001', '/uploads/products/headphones-1.jpg', 'Auriculares Premium vista frontal', 1),
('img-001-2', 'p-001', '/uploads/products/headphones-2.jpg', 'Auriculares Premium vista lateral', 2),
('img-002-1', 'p-002', '/uploads/products/smartphone-1.jpg', 'Smartphone Pro Max frontal', 1),
('img-003-1', 'p-003', '/uploads/products/laptop-1.jpg', 'Portátil Ultrabook abierto', 1),
('img-004-1', 'p-004', '/uploads/products/tshirt-1.jpg', 'Camiseta algodón premium', 1),
('img-005-1', 'p-005', '/uploads/products/running-shoes-1.jpg', 'Zapatillas running', 1),
('img-006-1', 'p-006', '/uploads/products/speaker-1.jpg', 'Altavoz bluetooth', 1),
('img-007-1', 'p-007', '/uploads/products/watch-1.jpg', 'Reloj minimalista', 1),
('img-008-1', 'p-008', '/uploads/products/backpack-1.jpg', 'Mochila urban', 1);

-- ─── SHIPPING METHODS ───────────────────────────────────

INSERT INTO shipping_methods (id, is_active, price, free_above, min_weight, max_weight, estimated_days, sort_order) VALUES
('ship-standard', 1, 4.99, 50.00, NULL, 30.00, '3-5', 1),
('ship-express', 1, 9.99, 100.00, NULL, 30.00, '1-2', 2),
('ship-pickup', 1, 0.00, NULL, NULL, NULL, '1-3', 3);

INSERT INTO shipping_method_translations (id, shipping_method_id, locale, name, description) VALUES
('smt-std-es', 'ship-standard', 'es', 'Envío Estándar', 'Entrega en 3-5 días laborables. Gratis a partir de 50€'),
('smt-std-en', 'ship-standard', 'en', 'Standard Shipping', 'Delivery in 3-5 business days. Free above €50'),
('smt-exp-es', 'ship-express', 'es', 'Envío Express', 'Entrega en 1-2 días laborables. Gratis a partir de 100€'),
('smt-exp-en', 'ship-express', 'en', 'Express Shipping', 'Delivery in 1-2 business days. Free above €100'),
('smt-pck-es', 'ship-pickup', 'es', 'Recogida en Tienda', 'Recoge tu pedido en nuestro punto de recogida'),
('smt-pck-en', 'ship-pickup', 'en', 'Store Pickup', 'Pick up your order at our collection point');

-- ─── PAYMENT METHODS ────────────────────────────────────

INSERT INTO payment_methods (id, type, is_active, sort_order) VALUES
('pay-stripe', 'stripe', 1, 1),
('pay-paypal', 'paypal', 1, 2),
('pay-cod', 'cod', 1, 3);

INSERT INTO payment_method_translations (id, payment_method_id, locale, name, description) VALUES
('pmt-str-es', 'pay-stripe', 'es', 'Tarjeta de crédito/débito', 'Paga de forma segura con Visa, Mastercard o American Express'),
('pmt-str-en', 'pay-stripe', 'en', 'Credit/Debit Card', 'Pay securely with Visa, Mastercard or American Express'),
('pmt-pp-es', 'pay-paypal', 'es', 'PayPal', 'Paga con tu cuenta de PayPal'),
('pmt-pp-en', 'pay-paypal', 'en', 'PayPal', 'Pay with your PayPal account'),
('pmt-cod-es', 'pay-cod', 'es', 'Contrareembolso', 'Paga en efectivo a la entrega (+2€ de recargo)'),
('pmt-cod-en', 'pay-cod', 'en', 'Cash on Delivery', 'Pay in cash upon delivery (+€2 surcharge)');

-- ─── COUPONS ────────────────────────────────────────────

INSERT INTO coupons (id, code, discount_type, discount_value, min_purchase, max_uses, is_active, expires_at) VALUES
('coup-welcome', 'WELCOME10', 'PERCENTAGE', 10.00, 30.00, 500, 1, '2027-12-31 23:59:59'),
('coup-summer', 'SUMMER25', 'PERCENTAGE', 25.00, 100.00, 100, 1, '2026-09-30 23:59:59'),
('coup-flat5', 'FLAT5', 'FIXED', 5.00, 25.00, NULL, 1, NULL);

-- ─── SAMPLE ORDERS ──────────────────────────────────────

INSERT INTO orders (id, order_number, user_id, status, payment_status, payment_method, subtotal, shipping_cost, discount, total, shipping_method_id, locale) VALUES
('ord-001', 'ORD-2026-0001', 'u-customer-001', 'DELIVERED', 'PAID', 'stripe', 149.99, 0.00, 0.00, 149.99, 'ship-standard', 'es'),
('ord-002', 'ORD-2026-0002', 'u-customer-002', 'SHIPPED', 'PAID', 'paypal', 1139.98, 0.00, 0.00, 1139.98, 'ship-express', 'es'),
('ord-003', 'ORD-2026-0003', 'u-customer-001', 'PROCESSING', 'PAID', 'stripe', 39.99, 4.99, 4.00, 40.98, 'ship-standard', 'es');

INSERT INTO order_items (id, order_id, product_id, variant_id, name, sku, price, quantity, variant_info) VALUES
('oi-001', 'ord-001', 'p-001', 'pv-001-black', 'Auriculares Premium Wireless', 'AUR-PRE-001-BLK', 149.99, 1, 'Color: Negro'),
('oi-002', 'ord-002', 'p-002', 'pv-002-256-blk', 'Smartphone Pro Max', 'PHONE-PRO-256-BLK', 1099.99, 1, '256GB / Negro'),
('oi-003', 'ord-002', 'p-004', 'pv-004-m-blk', 'Camiseta Algodón Premium', 'CAM-ALG-M-BLK', 39.99, 1, 'M / Negro'),
('oi-004', 'ord-003', 'p-004', 'pv-004-l-wht', 'Camiseta Algodón Premium', 'CAM-ALG-L-WHT', 39.99, 1, 'L / Blanco');

-- ─── REVIEWS ────────────────────────────────────────────

INSERT INTO reviews (id, user_id, product_id, rating, title, comment, is_approved) VALUES
('rev-001', 'u-customer-001', 'p-001', 5, '¡Increíbles!', 'La cancelación de ruido es brutal. Muy cómodos para uso prolongado.', 1),
('rev-002', 'u-customer-002', 'p-002', 4, 'Muy buen móvil', 'La cámara es espectacular, aunque la batería podría durar algo más.', 1),
('rev-003', 'u-customer-001', 'p-004', 5, 'Súper cómoda', 'El algodón es de muy buena calidad, muy suave.', 1);

-- ─── BLOG POSTS ─────────────────────────────────────────

INSERT INTO blog_posts (id, slug, is_published, published_at, author_id) VALUES
('blog-001', 'guia-auriculares-2026', 1, '2026-02-01 10:00:00', 'u-admin-001'),
('blog-002', 'tendencias-moda-primavera', 1, '2026-02-15 10:00:00', 'u-admin-001');

INSERT INTO blog_post_translations (id, blog_post_id, locale, title, excerpt, content, meta_title, meta_description) VALUES
('bpt-001-es', 'blog-001', 'es', 'Guía completa: Los mejores auriculares de 2026', 'Analizamos los auriculares más destacados del mercado para ayudarte a elegir.', '<h2>Los mejores auriculares de 2026</h2><p>En esta guía completa analizamos los auriculares que están marcando tendencia este año...</p><h3>1. Auriculares con cancelación de ruido</h3><p>La cancelación de ruido activa ha mejorado drásticamente...</p>', 'Guía auriculares 2026 — eShop Blog', 'Descubre los mejores auriculares del mercado en nuestra guía completa'),
('bpt-001-en', 'blog-001', 'en', 'Complete Guide: Best Headphones of 2026', 'We analyze the most outstanding headphones on the market to help you choose.', '<h2>Best Headphones of 2026</h2><p>In this complete guide we analyze the headphones that are trending this year...</p>', 'Headphone Guide 2026 — eShop Blog', 'Discover the best headphones on the market in our complete guide'),
('bpt-002-es', 'blog-002', 'es', 'Tendencias de moda primavera 2026', 'Las tendencias que dominarán la próxima temporada.', '<h2>Tendencias primavera 2026</h2><p>La primavera trae consigo nuevos colores, tejidos y siluetas...</p>', 'Tendencias moda primavera 2026 — eShop Blog', 'Descubre las tendencias de moda para esta primavera'),
('bpt-002-en', 'blog-002', 'en', 'Spring 2026 Fashion Trends', 'The trends that will dominate next season.', '<h2>Spring 2026 Trends</h2><p>Spring brings new colors, fabrics and silhouettes...</p>', 'Spring 2026 Fashion Trends — eShop Blog', 'Discover the fashion trends for this spring');

-- ─── LEGAL PAGES ────────────────────────────────────────

INSERT INTO legal_pages (id, slug) VALUES
('legal-privacy', 'privacy-policy'),
('legal-terms', 'terms-conditions'),
('legal-cookies', 'cookie-policy');

INSERT INTO legal_page_translations (id, legal_page_id, locale, title, content) VALUES
('lpt-priv-es', 'legal-privacy', 'es', 'Política de Privacidad', '<h1>Política de Privacidad</h1><p>En cumplimiento de la normativa vigente en protección de datos de carácter personal, le informamos que sus datos serán tratados por eShop con la finalidad de gestionar su relación comercial con nosotros...</p><h2>1. Responsable del tratamiento</h2><p>eShop S.L.</p><h2>2. Datos recogidos</h2><p>Nombre, email, dirección, teléfono, datos de compra.</p>'),
('lpt-priv-en', 'legal-privacy', 'en', 'Privacy Policy', '<h1>Privacy Policy</h1><p>In compliance with current data protection regulations, we inform you that your data will be processed by eShop for the purpose of managing your commercial relationship with us...</p>'),
('lpt-terms-es', 'legal-terms', 'es', 'Condiciones de Uso', '<h1>Condiciones de Uso</h1><p>Las presentes condiciones regulan el uso del sitio web eShop...</p><h2>1. Objeto</h2><p>Regular las condiciones de acceso y uso de la tienda online.</p>'),
('lpt-terms-en', 'legal-terms', 'en', 'Terms & Conditions', '<h1>Terms & Conditions</h1><p>These conditions regulate the use of the eShop website...</p>'),
('lpt-cook-es', 'legal-cookies', 'es', 'Política de Cookies', '<h1>Política de Cookies</h1><p>Este sitio web utiliza cookies propias y de terceros para mejorar la experiencia del usuario...</p>'),
('lpt-cook-en', 'legal-cookies', 'en', 'Cookie Policy', '<h1>Cookie Policy</h1><p>This website uses its own and third-party cookies to improve user experience...</p>');

-- ─── SITE SETTINGS ──────────────────────────────────────

INSERT INTO site_settings (id, `key`, value, type) VALUES
('ss-name', 'site_name', 'eShop', 'string'),
('ss-desc', 'site_description', 'Tu tienda online de confianza', 'string'),
('ss-logo', 'site_logo', '/uploads/logo.png', 'string'),
('ss-email', 'contact_email', 'info@eshop.com', 'string'),
('ss-phone', 'contact_phone', '+34 900 100 200', 'string'),
('ss-currency', 'currency', 'EUR', 'string'),
('ss-currency-sym', 'currency_symbol', '€', 'string'),
('ss-tax', 'tax_included', 'true', 'boolean'),
('ss-theme', 'theme', 'default', 'string'),
('ss-meta-title', 'default_meta_title', 'eShop — Tu tienda online', 'string'),
('ss-meta-desc', 'default_meta_description', 'Los mejores productos seleccionados para ti. Envío rápido y seguro.', 'string');
