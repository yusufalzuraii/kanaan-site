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

-- أجهزة تطبيق أندرويد/آيفون اللي وافقت تستقبل إشعارات (Firebase Cloud
-- Messaging). كل صف = جهاز واحد. توكن الجهاز بيتغيّر أحياناً (لما يمسح
-- بيانات التطبيق مثلاً)، فمنحدّثه بمكانه بدل ما نضيف صف مكرر.
CREATE TABLE IF NOT EXISTS push_tokens (
  token       TEXT PRIMARY KEY,
  platform    TEXT NOT NULL DEFAULT 'android',
  created_at  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL DEFAULT 0
);

-- is_spotlight: أنت تحدد يدوياً أي منتج يظهر ببطاقة "Just landed"
-- الكبيرة بالصفحة الرئيسية للتطبيق، بدل ما يُختار تلقائياً.
-- app_exclusive: سعر/منتج ما بيظهر عالموقع إطلاقاً — حصري لمستخدمي
-- التطبيق بس (قسم "App Exclusives").
ALTER TABLE products ADD COLUMN is_spotlight INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN app_exclusive INTEGER NOT NULL DEFAULT 0;
