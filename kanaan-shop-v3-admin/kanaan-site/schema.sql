-- Kanaan Shop — full database schema (Cloudflare D1)
-- ============================================================
-- This file is a REFERENCE — it documents every table that exists in
-- the live database right now, all in one place, organized by feature.
--
-- ⚠️ Your live database already has all of this. Do NOT re-run this
-- file against it — some of these tables were originally created via
-- separate migrations run one at a time in the D1 Console, and this
-- file just consolidates them for a single source of truth going
-- forward. It's only meant to be run start-to-finish on a brand new,
-- empty database (e.g. if you ever needed to rebuild from scratch).
-- ============================================================


-- ---------- Products ----------
-- The catalogue. subcategory holds an optional "fit" (e.g. jeans →
-- baggy/regular) — empty string means "no fit set". is_spotlight lets
-- you manually choose which product features on the app's home "Just
-- landed" card instead of it being picked automatically. app_exclusive
-- marks a product as only visible in the "App Exclusives" section —
-- never shown on the website.
CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,        -- slug, e.g. "harbor-slim-jeans"
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,           -- tshirts | shirts | jeans | pants | shorts | sets | underwear | shoes | slippers | accessories | oldmoney
  subcategory   TEXT NOT NULL DEFAULT '', -- '' | oversized | regular | baggy  (fit, only for categories that have one)
  price         REAL NOT NULL DEFAULT 0,
  colors        TEXT NOT NULL DEFAULT '',   -- comma-separated color keys
  sizes         TEXT NOT NULL DEFAULT '',   -- comma-separated sizes
  description   TEXT NOT NULL DEFAULT '',
  badge         TEXT NOT NULL DEFAULT '',   -- '' | 'new' | 'sale'
  discount      INTEGER NOT NULL DEFAULT 0, -- percent, only used when badge='sale'
  images        TEXT NOT NULL DEFAULT '',   -- JSON array of {url, color} (legacy rows may be a plain comma-separated string)
  sold_out      INTEGER NOT NULL DEFAULT 0, -- 0 | 1
  active        INTEGER NOT NULL DEFAULT 1, -- 0 | 1  (0 = hidden from shop)
  is_spotlight  INTEGER NOT NULL DEFAULT 0, -- 0 | 1  (manually featured on the app home screen)
  app_exclusive INTEGER NOT NULL DEFAULT 0, -- 0 | 1  (only shown in the app's "App Exclusives" section)
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products (active, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
CREATE INDEX IF NOT EXISTS idx_products_sub ON products (category, subcategory);


-- ---------- Inventory ----------
-- Per-variant stock: one row per product + color + size. A product with
-- NO rows here is "not tracked" and stays always available.
CREATE TABLE IF NOT EXISTS variants (
  product_id  TEXT NOT NULL,
  color       TEXT NOT NULL,
  size        TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 0,
  reserved    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, color, size)
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON variants (product_id);


-- ---------- Orders ----------
-- Stock is reserved while status = 'pending', deducted on 'confirmed',
-- and released on 'cancelled' / 'expired'.
CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  status          TEXT NOT NULL DEFAULT 'pending',
  customer_name   TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',
  area            TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL DEFAULT '',
  notes           TEXT NOT NULL DEFAULT '',
  items           TEXT NOT NULL DEFAULT '[]',
  subtotal        REAL NOT NULL DEFAULT 0,
  delivery        REAL NOT NULL DEFAULT 0,
  total           REAL NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at);


-- ---------- "The Edit" (stories) ----------
-- One row = one slide. Several slides sharing the same ring_id form one
-- ring. Auto rings (Sale / New In) aren't stored here — computed live
-- from the products table on every request.
CREATE TABLE IF NOT EXISTS stories (
  id                TEXT PRIMARY KEY,
  ring_id           TEXT NOT NULL,
  ring_title        TEXT NOT NULL DEFAULT '',
  ring_type         TEXT NOT NULL DEFAULT 'editorial', -- 'editorial' | 'compare'
  pinned            INTEGER NOT NULL DEFAULT 1,
  expires_at        INTEGER,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  image             TEXT NOT NULL DEFAULT '',
  image_b           TEXT NOT NULL DEFAULT '', -- 'compare' slides only: second photo
  label_a           TEXT NOT NULL DEFAULT '',
  label_b           TEXT NOT NULL DEFAULT '',
  cta_category      TEXT NOT NULL DEFAULT '',
  cta_subcategory   TEXT NOT NULL DEFAULT '',
  caption           TEXT NOT NULL DEFAULT '',
  tags              TEXT NOT NULL DEFAULT '[]', -- JSON [{productId, x, y}]
  active            INTEGER NOT NULL DEFAULT 1,
  created_at        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stories_ring ON stories (ring_id, sort_order);


-- ---------- Android app support ----------

-- Devices that opted in to push notifications (Firebase Cloud Messaging).
-- One row per device; the token is updated in place if it changes
-- (e.g. after the app's storage is cleared) rather than duplicated.
CREATE TABLE IF NOT EXISTS push_tokens (
  token       TEXT PRIMARY KEY,
  platform    TEXT NOT NULL DEFAULT 'android',
  created_at  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT 0
);

-- "Notify me when back in stock" — links a device (push token) to a
-- sold-out product. When the admin marks it available again, everyone
-- subscribed gets a notification and the subscription is deleted
-- (one-time use).
CREATE TABLE IF NOT EXISTS restock_subscriptions (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL,
  token       TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT 0,
  UNIQUE(product_id, token)
);

CREATE INDEX IF NOT EXISTS idx_restock_product ON restock_subscriptions (product_id);

-- Simple key/value settings. First (and so far only) use: the latest
-- published Android version number, so the app can show an "update
-- available" banner to anyone on an older build.
CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

-- Crash reports, sent automatically by the app/website's Error Boundary
-- whenever something throws unexpectedly. Gives real visibility into
-- bugs after release instead of relying only on customer complaints.
CREATE TABLE IF NOT EXISTS error_logs (
  id               TEXT PRIMARY KEY,
  message          TEXT NOT NULL DEFAULT '',
  stack            TEXT NOT NULL DEFAULT '',
  component_stack  TEXT NOT NULL DEFAULT '',
  url              TEXT NOT NULL DEFAULT '',
  platform         TEXT NOT NULL DEFAULT '',
  created_at       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs (created_at);
