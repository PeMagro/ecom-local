-- ============ ENUMS ============
CREATE TYPE public.marketplace_channel AS ENUM ('mercado_livre', 'shopee', 'amazon');
CREATE TYPE public.connection_status AS ENUM ('disconnected', 'connecting', 'connected', 'error');
CREATE TYPE public.product_status AS ENUM ('active', 'inactive', 'archived');
CREATE TYPE public.listing_status AS ENUM ('draft', 'ready', 'publishing', 'active', 'paused', 'error');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE public.movement_type AS ENUM ('entry', 'sale', 'adjustment', 'return', 'reservation', 'release');
CREATE TYPE public.alert_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE public.sync_status AS ENUM ('pending', 'running', 'success', 'error');
CREATE TYPE public.ai_role AS ENUM ('user', 'assistant', 'system');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  cpf TEXT,
  phone TEXT,
  avatar_url TEXT,
  company_name TEXT,
  company_document TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SELLER SETTINGS ============
CREATE TABLE public.seller_settings (
  user_id UUID PRIMARY KEY,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  sells_online BOOLEAN,
  marketplaces public.marketplace_channel[] NOT NULL DEFAULT '{}',
  ai_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_provider TEXT,
  ai_model TEXT,
  default_landing TEXT NOT NULL DEFAULT 'overview',
  density TEXT NOT NULL DEFAULT 'comfortable',
  currency TEXT NOT NULL DEFAULT 'BRL',
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  notifications JSONB NOT NULL DEFAULT '{"low_stock":true,"new_orders":true,"sync_errors":true,"email":false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_settings TO authenticated;
GRANT ALL ON public.seller_settings TO service_role;
ALTER TABLE public.seller_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller_settings_all_own" ON public.seller_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER seller_settings_updated_at BEFORE UPDATE ON public.seller_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, cpf)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email, NEW.raw_user_meta_data ->> 'cpf')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.seller_settings (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ MARKETPLACE CONNECTIONS ============
CREATE TABLE public.marketplace_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  marketplace public.marketplace_channel NOT NULL,
  status public.connection_status NOT NULL DEFAULT 'disconnected',
  account_id TEXT,
  account_name TEXT,
  account_email TEXT,
  site_id TEXT,
  scopes TEXT,
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, marketplace)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_connections TO authenticated;
GRANT ALL ON public.marketplace_connections TO service_role;
ALTER TABLE public.marketplace_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connections_all_own" ON public.marketplace_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER marketplace_connections_updated_at BEFORE UPDATE ON public.marketplace_connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.marketplace_credentials (
  connection_id UUID PRIMARY KEY REFERENCES public.marketplace_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_type TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.marketplace_credentials TO service_role;
ALTER TABLE public.marketplace_credentials ENABLE ROW LEVEL SECURITY;

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  description TEXT,
  category TEXT,
  brand TEXT,
  status public.product_status NOT NULL DEFAULT 'active',
  price NUMERIC(12,2),
  cost NUMERIC(12,2),
  weight_grams NUMERIC(12,2),
  length_cm NUMERIC(10,2),
  width_cm NUMERIC(10,2),
  height_cm NUMERIC(10,2),
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_user_idx ON public.products(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_all_own" ON public.products FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price NUMERIC(12,2),
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_variants_product_idx ON public.product_variants(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_variants_all_own" ON public.product_variants FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER product_variants_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  storage_path TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  alt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX product_images_product_idx ON public.product_images(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_images TO authenticated;
GRANT ALL ON public.product_images TO service_role;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_images_all_own" ON public.product_images FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ LISTINGS ============
CREATE TABLE public.marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  marketplace public.marketplace_channel NOT NULL,
  status public.listing_status NOT NULL DEFAULT 'draft',
  title TEXT,
  description TEXT,
  category_path TEXT,
  external_category_id TEXT,
  price NUMERIC(12,2),
  stock INTEGER,
  external_id TEXT,
  external_url TEXT,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_error TEXT,
  published_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX marketplace_listings_user_idx ON public.marketplace_listings(user_id);
CREATE INDEX marketplace_listings_product_idx ON public.marketplace_listings(product_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_listings TO authenticated;
GRANT ALL ON public.marketplace_listings TO service_role;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings_all_own" ON public.marketplace_listings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER marketplace_listings_updated_at BEFORE UPDATE ON public.marketplace_listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  marketplace public.marketplace_channel NOT NULL,
  external_order_id TEXT NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  buyer_name TEXT,
  buyer_email TEXT,
  buyer_document TEXT,
  shipping_address JSONB,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  fees_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  placed_at TIMESTAMPTZ,
  history JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, marketplace, external_order_id)
);
CREATE INDEX orders_user_idx ON public.orders(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_all_own" ON public.orders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  listing_id UUID REFERENCES public.marketplace_listings(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items_all_own" ON public.order_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ SALES ============
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  marketplace public.marketplace_channel NOT NULL,
  external_order_id TEXT,
  buyer_name TEXT,
  product_title TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12,2),
  fees_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'paid',
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sales_user_idx ON public.sales(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales_all_own" ON public.sales FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ INVENTORY ============
CREATE TABLE public.inventory_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX inventory_balances_unique_idx ON public.inventory_balances(product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_balances TO authenticated;
GRANT ALL ON public.inventory_balances TO service_role;
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_balances_all_own" ON public.inventory_balances FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER inventory_balances_updated_at BEFORE UPDATE ON public.inventory_balances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
  type public.movement_type NOT NULL,
  quantity INTEGER NOT NULL,
  balance_after INTEGER,
  reason TEXT,
  marketplace public.marketplace_channel,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX inventory_movements_user_idx ON public.inventory_movements(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_movements TO authenticated;
GRANT ALL ON public.inventory_movements TO service_role;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_movements_all_own" ON public.inventory_movements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ AI ============
CREATE TABLE public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_conversations_user_idx ON public.ai_conversations(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_conversations_all_own" ON public.ai_conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER ai_conversations_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role public.ai_role NOT NULL,
  content TEXT NOT NULL,
  parts JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_conversation_idx ON public.ai_messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_messages_all_own" ON public.ai_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ SYNC LOGS & ALERTS ============
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  marketplace public.marketplace_channel,
  entity TEXT NOT NULL,
  entity_id UUID,
  direction TEXT NOT NULL DEFAULT 'outbound',
  status public.sync_status NOT NULL DEFAULT 'pending',
  message TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX sync_logs_user_idx ON public.sync_logs(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sync_logs TO authenticated;
GRANT ALL ON public.sync_logs TO service_role;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_logs_all_own" ON public.sync_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  severity public.alert_severity NOT NULL DEFAULT 'info',
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  entity TEXT,
  entity_id UUID,
  read_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX alerts_user_idx ON public.alerts(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_all_own" ON public.alerts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ INVENTORY FUNCTION ============
CREATE OR REPLACE FUNCTION public.apply_inventory_movement(
  _product_id UUID,
  _variant_id UUID,
  _type public.movement_type,
  _quantity INTEGER,
  _reason TEXT DEFAULT NULL
)
RETURNS public.inventory_balances
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _delta INTEGER;
  _balance public.inventory_balances;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  _delta := CASE
    WHEN _type = 'sale' THEN -abs(_quantity)
    WHEN _type IN ('entry', 'return', 'release') THEN abs(_quantity)
    WHEN _type = 'reservation' THEN -abs(_quantity)
    ELSE _quantity
  END;

  INSERT INTO public.inventory_balances (user_id, product_id, variant_id, quantity)
  VALUES (_uid, _product_id, _variant_id, GREATEST(_delta, 0))
  ON CONFLICT (product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  DO UPDATE SET quantity = public.inventory_balances.quantity + _delta, updated_at = now()
  RETURNING * INTO _balance;

  INSERT INTO public.inventory_movements (user_id, product_id, variant_id, type, quantity, balance_after, reason)
  VALUES (_uid, _product_id, _variant_id, _type, _delta, _balance.quantity, _reason);

  RETURN _balance;
END;
$$;
GRANT EXECUTE ON FUNCTION public.apply_inventory_movement(UUID, UUID, public.movement_type, INTEGER, TEXT) TO authenticated;

-- ============ STORAGE POLICIES ============
CREATE POLICY "product_images_read_own" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "product_images_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "product_images_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "product_images_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text);
