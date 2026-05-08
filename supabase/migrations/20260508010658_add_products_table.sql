CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL,
  member_name TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- in cents
  currency TEXT NOT NULL DEFAULT 'usd',
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read" ON products
  FOR SELECT USING (active = true);

CREATE POLICY "service_write" ON products
  FOR ALL USING (true) WITH CHECK (true);

-- Zahab Energy products
INSERT INTO products (member_id, member_name, name, description, price) VALUES
  ('89516919-256f-4a95-96df-fc9d285f664a', 'Zahab', 'Solar Home System 50W', 'Off-grid solar kit for basic home lighting and phone charging', 29900),
  ('89516919-256f-4a95-96df-fc9d285f664a', 'Zahab', 'Solar Panel 200W', 'High-efficiency monocrystalline solar panel for residential use', 89900),
  ('89516919-256f-4a95-96df-fc9d285f664a', 'Zahab', 'Energy Consultation', 'On-site assessment and custom energy system design for your home or business', 15000);
