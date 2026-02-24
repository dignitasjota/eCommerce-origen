-- ═══════════════════════════════════════════════════════
-- eCommerce — Database Creation & Schema
-- Run this file first to create the database and all tables
-- Compatible with MariaDB 10.5+
-- ═══════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS ecommerce
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ecommerce;

-- ─── USERS & AUTH ────────────────────────────────────────

CREATE TABLE users (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  email_verified DATETIME(3) NULL,
  password_hash VARCHAR(255) NULL,
  name VARCHAR(255) NULL,
  phone VARCHAR(50) NULL,
  role ENUM('ADMIN', 'ORDER_MANAGER', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  image VARCHAR(500) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE accounts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  refresh_token TEXT NULL,
  access_token TEXT NULL,
  expires_at INT NULL,
  token_type VARCHAR(255) NULL,
  scope VARCHAR(255) NULL,
  id_token TEXT NULL,
  session_state VARCHAR(255) NULL,
  UNIQUE KEY uq_provider_account (provider, provider_account_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE sessions (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  user_id VARCHAR(36) NOT NULL,
  expires DATETIME(3) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires DATETIME(3) NOT NULL,
  UNIQUE KEY uq_identifier_token (identifier, token)
) ENGINE=InnoDB;

-- ─── ADDRESSES ──────────────────────────────────────────

CREATE TABLE addresses (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  company VARCHAR(255) NULL,
  address1 VARCHAR(255) NOT NULL,
  address2 VARCHAR(255) NULL,
  city VARCHAR(255) NOT NULL,
  state VARCHAR(255) NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  phone VARCHAR(50) NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── CATEGORIES ─────────────────────────────────────────

CREATE TABLE categories (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  parent_id VARCHAR(36) NULL,
  image VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE category_translations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  category_id VARCHAR(36) NOT NULL,
  locale VARCHAR(5) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  UNIQUE KEY uq_category_locale (category_id, locale),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── PRODUCTS ───────────────────────────────────────────

CREATE TABLE products (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  sku VARCHAR(100) NOT NULL UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE product_translations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  locale VARCHAR(5) NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_description TEXT NULL,
  description LONGTEXT NULL,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  UNIQUE KEY uq_product_locale (product_id, locale),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE product_categories (
  product_id VARCHAR(36) NOT NULL,
  category_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (product_id, category_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE product_images (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  url VARCHAR(500) NOT NULL,
  alt VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── VARIANTS ───────────────────────────────────────────

CREATE TABLE variant_types (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE variant_type_translations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  variant_type_id VARCHAR(36) NOT NULL,
  locale VARCHAR(5) NOT NULL,
  name VARCHAR(255) NOT NULL,
  UNIQUE KEY uq_variant_type_locale (variant_type_id, locale),
  FOREIGN KEY (variant_type_id) REFERENCES variant_types(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE variant_options (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  variant_type_id VARCHAR(36) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_variant_type_slug (variant_type_id, slug),
  FOREIGN KEY (variant_type_id) REFERENCES variant_types(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE variant_option_translations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  variant_option_id VARCHAR(36) NOT NULL,
  locale VARCHAR(5) NOT NULL,
  value VARCHAR(255) NOT NULL,
  UNIQUE KEY uq_variant_option_locale (variant_option_id, locale),
  FOREIGN KEY (variant_option_id) REFERENCES variant_options(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE product_variants (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  product_id VARCHAR(36) NOT NULL,
  sku VARCHAR(100) NOT NULL UNIQUE,
  price DECIMAL(10,2) NULL,
  stock INT NOT NULL DEFAULT 0,
  weight DECIMAL(8,2) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE product_variant_options (
  variant_id VARCHAR(36) NOT NULL,
  variant_option_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (variant_id, variant_option_id),
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_option_id) REFERENCES variant_options(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── CART ────────────────────────────────────────────────

CREATE TABLE cart_items (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NULL,
  session_id VARCHAR(255) NULL,
  product_id VARCHAR(36) NOT NULL,
  variant_id VARCHAR(36) NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─── COUPONS ────────────────────────────────────────────

CREATE TABLE coupons (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  discount_type ENUM('PERCENTAGE', 'FIXED') NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  min_purchase DECIMAL(10,2) NULL,
  max_uses INT NULL,
  used_count INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  starts_at DATETIME(3) NULL,
  expires_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

-- ─── SHIPPING METHODS ───────────────────────────────────

CREATE TABLE shipping_methods (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,
  free_above DECIMAL(10,2) NULL,
  min_weight DECIMAL(8,2) NULL,
  max_weight DECIMAL(8,2) NULL,
  estimated_days VARCHAR(50) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE shipping_method_translations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  shipping_method_id VARCHAR(36) NOT NULL,
  locale VARCHAR(5) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  UNIQUE KEY uq_shipping_method_locale (shipping_method_id, locale),
  FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── PAYMENT METHODS ────────────────────────────────────

CREATE TABLE payment_methods (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  type VARCHAR(50) NOT NULL UNIQUE,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  config TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE payment_method_translations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  payment_method_id VARCHAR(36) NOT NULL,
  locale VARCHAR(5) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  UNIQUE KEY uq_payment_method_locale (payment_method_id, locale),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── ORDERS ─────────────────────────────────────────────

CREATE TABLE orders (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  user_id VARCHAR(36) NULL,
  guest_email VARCHAR(255) NULL,
  guest_name VARCHAR(255) NULL,
  status ENUM('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  payment_status ENUM('PENDING','PAID','FAILED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  payment_method VARCHAR(50) NULL,
  payment_id VARCHAR(255) NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  tax DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  total DECIMAL(10,2) NOT NULL,
  coupon_id VARCHAR(36) NULL,
  shipping_address_id VARCHAR(36) NULL,
  billing_address_id VARCHAR(36) NULL,
  shipping_method_id VARCHAR(36) NULL,
  notes TEXT NULL,
  tracking_number VARCHAR(255) NULL,
  locale VARCHAR(5) NOT NULL DEFAULT 'es',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL,
  FOREIGN KEY (shipping_address_id) REFERENCES addresses(id) ON DELETE SET NULL,
  FOREIGN KEY (billing_address_id) REFERENCES addresses(id) ON DELETE SET NULL,
  FOREIGN KEY (shipping_method_id) REFERENCES shipping_methods(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NULL,
  variant_id VARCHAR(36) NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL,
  variant_info TEXT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ─── REVIEWS ────────────────────────────────────────────

CREATE TABLE reviews (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  rating INT NOT NULL,
  title VARCHAR(255) NULL,
  comment TEXT NULL,
  is_approved TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_product_review (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── WISHLIST ───────────────────────────────────────────

CREATE TABLE wishlist_items (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  product_id VARCHAR(36) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_user_product_wishlist (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── BLOG ───────────────────────────────────────────────

CREATE TABLE blog_posts (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  image VARCHAR(500) NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  published_at DATETIME(3) NULL,
  author_id VARCHAR(36) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE blog_post_translations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  blog_post_id VARCHAR(36) NOT NULL,
  locale VARCHAR(5) NOT NULL,
  title VARCHAR(255) NOT NULL,
  excerpt TEXT NULL,
  content LONGTEXT NOT NULL,
  meta_title VARCHAR(255) NULL,
  meta_description TEXT NULL,
  UNIQUE KEY uq_blog_post_locale (blog_post_id, locale),
  FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── LEGAL PAGES ────────────────────────────────────────

CREATE TABLE legal_pages (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB;

CREATE TABLE legal_page_translations (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  legal_page_id VARCHAR(36) NOT NULL,
  locale VARCHAR(5) NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  UNIQUE KEY uq_legal_page_locale (legal_page_id, locale),
  FOREIGN KEY (legal_page_id) REFERENCES legal_pages(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ─── SITE SETTINGS ──────────────────────────────────────

CREATE TABLE site_settings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  `key` VARCHAR(255) NOT NULL UNIQUE,
  value LONGTEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'string'
) ENGINE=InnoDB;

-- ─── INDEXES FOR PERFORMANCE ────────────────────────────

CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_is_featured ON products(is_featured);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_cart_user ON cart_items(user_id);
CREATE INDEX idx_cart_session ON cart_items(session_id);
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_blog_slug ON blog_posts(slug);
CREATE INDEX idx_blog_published ON blog_posts(is_published);
