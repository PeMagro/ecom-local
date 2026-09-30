-- ECOM — SQLite schema (migrated from Supabase/PostgreSQL)
-- Conventions:
--   UUID          -> TEXT (app/DB-generated via gen_random_uuid(), a custom
--                    function registered by sqlite/db bootstrap code — see
--                    src/lib/sqlite/client.ts)
--   TIMESTAMPTZ   -> TEXT, ISO-8601 UTC, default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
--   JSONB         -> TEXT, validated with CHECK(json_valid(...))
--   NUMERIC(12,2) -> REAL (kept as decimal-like float to match existing app
--                    code, which already treats these as plain JS numbers;
--                    if stricter precision is needed later, switch to
--                    INTEGER cents — that requires updating every read/write
--                    site in the app, so it is out of scope here)
--   ENUM          -> TEXT + CHECK(col IN (...))
--   array column  -> TEXT JSON array, CHECK(json_valid(...))
--   RLS / GRANT   -> none (SQLite has no RLS). Every table with a user_id
--                    column is indexed on it; the application layer MUST
--                    filter every query by the authenticated user's id.
--   auth.users    -> explicit `users` table (local email/password auth)

PRAGMA foreign_keys = ON;

-- ============ USERS (replaces Supabase auth.users) ============
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE users SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

-- ============ PROFILES ============
CREATE TABLE profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  cpf TEXT,
  phone TEXT,
  avatar_url TEXT,
  company_name TEXT,
  company_document TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER trg_profiles_updated_at
AFTER UPDATE ON profiles
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE profiles SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

-- ============ SELLER SETTINGS ============
CREATE TABLE seller_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  onboarding_completed INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_completed IN (0,1)),
  sells_online INTEGER CHECK (sells_online IS NULL OR sells_online IN (0,1)),
  marketplaces TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(marketplaces)),
  ai_enabled INTEGER NOT NULL DEFAULT 0 CHECK (ai_enabled IN (0,1)),
  ai_provider TEXT,
  ai_model TEXT,
  default_landing TEXT NOT NULL DEFAULT 'overview',
  density TEXT NOT NULL DEFAULT 'comfortable',
  currency TEXT NOT NULL DEFAULT 'BRL',
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  notifications TEXT NOT NULL DEFAULT '{"low_stock":true,"new_orders":true,"sync_errors":true,"email":false}' CHECK (json_valid(notifications)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TRIGGER trg_seller_settings_updated_at
AFTER UPDATE ON seller_settings
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE seller_settings SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE user_id = NEW.user_id;
END;

-- Replaces the Postgres handle_new_user() trigger on auth.users.
-- NOTE: Supabase pulled full_name/cpf out of the signup call's
-- raw_user_meta_data at insert time. There is no equivalent metadata bag on
-- a plain `users` row here, so this trigger only seeds blank profile +
-- default settings rows; the app must UPDATE profiles with full_name/cpf
-- right after it inserts the new user during sign-up.
CREATE TRIGGER trg_users_after_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
  INSERT INTO profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO seller_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
END;

-- ============ MARKETPLACE CONNECTIONS ============
CREATE TABLE marketplace_connections (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('mercado_livre','shopee','amazon')),
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','connecting','connected','error')),
  account_id TEXT,
  account_name TEXT,
  account_email TEXT,
  site_id TEXT,
  scopes TEXT,
  last_sync_at TEXT,
  last_error TEXT,
  connected_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, marketplace)
);
CREATE INDEX marketplace_connections_user_idx ON marketplace_connections(user_id);

CREATE TRIGGER trg_marketplace_connections_updated_at
AFTER UPDATE ON marketplace_connections
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE marketplace_connections SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TABLE marketplace_credentials (
  connection_id TEXT PRIMARY KEY REFERENCES marketplace_connections(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  token_type TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX marketplace_credentials_user_idx ON marketplace_credentials(user_id);

CREATE TRIGGER trg_marketplace_credentials_updated_at
AFTER UPDATE ON marketplace_credentials
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE marketplace_credentials SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE connection_id = NEW.connection_id;
END;

-- ============ PRODUCTS ============
CREATE TABLE products (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  description TEXT,
  category TEXT,
  brand TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
  price REAL,
  cost REAL,
  weight_grams REAL,
  length_cm REAL,
  width_cm REAL,
  height_cm REAL,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX products_user_idx ON products(user_id);

CREATE TRIGGER trg_products_updated_at
AFTER UPDATE ON products
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE products SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TABLE product_variants (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price REAL,
  attributes TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(attributes)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX product_variants_product_idx ON product_variants(product_id);
CREATE INDEX product_variants_user_idx ON product_variants(user_id);

CREATE TRIGGER trg_product_variants_updated_at
AFTER UPDATE ON product_variants
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE product_variants SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TABLE product_images (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  alt_text TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX product_images_product_idx ON product_images(product_id);
CREATE INDEX product_images_user_idx ON product_images(user_id);

-- ============ LISTINGS ============
CREATE TABLE marketplace_listings (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('mercado_livre','shopee','amazon')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','publishing','active','paused','error')),
  title TEXT,
  description TEXT,
  category_path TEXT,
  external_category_id TEXT,
  price REAL,
  stock INTEGER,
  external_id TEXT,
  external_url TEXT,
  validation_errors TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(validation_errors)),
  last_error TEXT,
  published_at TEXT,
  last_sync_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX marketplace_listings_user_idx ON marketplace_listings(user_id);
CREATE INDEX marketplace_listings_product_idx ON marketplace_listings(product_id);

CREATE TRIGGER trg_marketplace_listings_updated_at
AFTER UPDATE ON marketplace_listings
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE marketplace_listings SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

-- ============ ORDERS ============
CREATE TABLE orders (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('mercado_livre','shopee','amazon')),
  external_order_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','delivered','cancelled','refunded')),
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_document TEXT,
  shipping_address TEXT CHECK (shipping_address IS NULL OR json_valid(shipping_address)),
  total_amount REAL NOT NULL DEFAULT 0,
  shipping_amount REAL NOT NULL DEFAULT 0,
  fees_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  placed_at TEXT,
  history TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(history)),
  raw_payload TEXT CHECK (raw_payload IS NULL OR json_valid(raw_payload)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, marketplace, external_order_id)
);
CREATE INDEX orders_user_idx ON orders(user_id);

CREATE TRIGGER trg_orders_updated_at
AFTER UPDATE ON orders
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE orders SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TABLE order_items (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  listing_id TEXT REFERENCES marketplace_listings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  total_price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX order_items_order_idx ON order_items(order_id);
CREATE INDEX order_items_user_idx ON order_items(user_id);

-- ============ SALES ============
CREATE TABLE sales (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL CHECK (marketplace IN ('mercado_livre','shopee','amazon')),
  external_order_id TEXT,
  buyer_name TEXT,
  product_title TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  gross_amount REAL NOT NULL DEFAULT 0,
  net_amount REAL,
  fees_amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','shipped','delivered','cancelled','refunded')),
  sold_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX sales_user_idx ON sales(user_id);

CREATE TRIGGER trg_sales_updated_at
AFTER UPDATE ON sales
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE sales SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

-- ============ INVENTORY ============
CREATE TABLE inventory_balances (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- Mirrors the Postgres COALESCE(variant_id, <zero-uuid>) unique index so a
-- product with no variant still gets a single balance row.
CREATE UNIQUE INDEX inventory_balances_unique_idx
  ON inventory_balances(product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX inventory_balances_user_idx ON inventory_balances(user_id);

CREATE TRIGGER trg_inventory_balances_updated_at
AFTER UPDATE ON inventory_balances
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE inventory_balances SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TABLE inventory_movements (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('entry','sale','adjustment','return','reservation','release')),
  quantity INTEGER NOT NULL,
  balance_after INTEGER,
  reason TEXT,
  marketplace TEXT CHECK (marketplace IS NULL OR marketplace IN ('mercado_livre','shopee','amazon')),
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX inventory_movements_user_idx ON inventory_movements(user_id, created_at DESC);

-- ============ AI ============
CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ai_conversations_user_idx ON ai_conversations(user_id, updated_at DESC);

CREATE TRIGGER trg_ai_conversations_updated_at
AFTER UPDATE ON ai_conversations
FOR EACH ROW WHEN NEW.updated_at IS OLD.updated_at
BEGIN
  UPDATE ai_conversations SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = NEW.id;
END;

CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  parts TEXT CHECK (parts IS NULL OR json_valid(parts)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX ai_messages_conversation_idx ON ai_messages(conversation_id, created_at);
CREATE INDEX ai_messages_user_idx ON ai_messages(user_id);

-- ============ SYNC LOGS & ALERTS ============
CREATE TABLE sync_logs (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marketplace TEXT CHECK (marketplace IS NULL OR marketplace IN ('mercado_livre','shopee','amazon')),
  entity TEXT NOT NULL,
  entity_id TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','success','error')),
  message TEXT,
  payload TEXT CHECK (payload IS NULL OR json_valid(payload)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT
);
CREATE INDEX sync_logs_user_idx ON sync_logs(user_id, created_at DESC);

CREATE TABLE alerts (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  entity TEXT,
  entity_id TEXT,
  read_at TEXT,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX alerts_user_idx ON alerts(user_id, created_at DESC);

-- NOTE on storage: the four `product_images_*` Supabase Storage RLS
-- policies have no SQLite equivalent (SQLite is not a file/object store).
-- Keep uploaded images on local disk or an S3-compatible bucket and store
-- only the resulting path/URL in product_images.storage_path; enforce the
-- "users can only touch their own folder" rule in the upload/delete route
-- handler instead of in the database.
