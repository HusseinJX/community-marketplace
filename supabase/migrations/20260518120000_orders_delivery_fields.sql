-- delivery fields on orders (Phase 3: Uber Direct)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_address JSONB,
  ADD COLUMN IF NOT EXISTS delivery_fee_cents INTEGER,
  ADD COLUMN IF NOT EXISTS uber_quote_id TEXT;
