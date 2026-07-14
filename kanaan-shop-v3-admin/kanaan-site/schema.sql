-- Kanaan Shop — products table (Cloudflare D1)
-- Run this once when you create the database (the guide explains how).

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,        -- slug, e.g. "harbor-slim-jeans"
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,           -- tshirts | jeans | pants | sets | shorts | shoes
  price       REAL NOT NULL DEFAULT 0,
  colors      TEXT NOT NULL DEFAULT '',   -- comma-separated color keys
  sizes       TEXT NOT NULL DEFAULT '',   -- comma-separated sizes
  description TEXT NOT NULL DEFAULT '',
  badge       TEXT NOT NULL DEFAULT '',   -- '' | 'new' | 'sale'
  discount    INTEGER NOT NULL DEFAULT 0, -- percent, only used when badge='sale'
  images      TEXT NOT NULL DEFAULT '',   -- comma-separated image paths (/img/...)
  sold_out    INTEGER NOT NULL DEFAULT 0, -- 0 | 1
  active      INTEGER NOT NULL DEFAULT 1, -- 0 | 1  (0 = hidden from shop)
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_products_active ON products (active, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category);
