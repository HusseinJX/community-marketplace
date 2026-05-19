-- orders: one row per completed payment intent
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  payment_intent_id TEXT UNIQUE NOT NULL,
  member_id TEXT NOT NULL,
  buyer_email TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  items JSONB NOT NULL DEFAULT '[]',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  vendor_amount_cents INTEGER NOT NULL DEFAULT 0,
  delivery_requested BOOLEAN NOT NULL DEFAULT false,
  uber_delivery_id TEXT,
  uber_tracking_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- vendor_settings: per-vendor feature flags + integration credentials
CREATE TABLE vendor_settings (
  member_id TEXT PRIMARY KEY,
  uber_direct_enabled BOOLEAN NOT NULL DEFAULT false,
  uber_pickup_address TEXT,
  uber_pickup_phone TEXT,
  composio_connection_id TEXT,
  composio_platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- allow service operations; anon can read orders by member_id for vendor dashboard
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_open" ON orders FOR ALL USING (true);
CREATE POLICY "vendor_settings_open" ON vendor_settings FOR ALL USING (true);
