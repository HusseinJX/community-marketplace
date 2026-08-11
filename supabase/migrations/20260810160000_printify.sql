-- Print-on-demand via Printify.
--
-- A vendor connects their own Printify account, their products import into the
-- marketplace catalog, and a paid order is pushed to Printify for production
-- and shipping.

-- ── Credentials ──────────────────────────────────────────────────────────────
-- A SEPARATE table, and this is the point of it: `vendor_settings` grants
-- SELECT to `anon`, so a Printify API token stored there would be readable by
-- anything holding the anon key. A credential that can spend a vendor's money
-- and reprint their catalog does not belong in a table the public role can
-- read. Nothing but the server ever touches this one.
CREATE TABLE IF NOT EXISTS vendor_secrets (
  member_id TEXT PRIMARY KEY,
  printify_token TEXT,
  printify_shop_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE vendor_secrets ENABLE ROW LEVEL SECURITY;
-- No policy for anon/authenticated at all — not an open one. RLS with no
-- matching policy denies by default, which is what we want here.
REVOKE ALL ON vendor_secrets FROM anon, authenticated;
GRANT ALL ON vendor_secrets TO service_role;

COMMENT ON TABLE vendor_secrets IS
  'Vendor API credentials. service_role ONLY — never grant anon/authenticated. Kept out of vendor_settings precisely because that table is anon-readable.';

-- ── Imported products ────────────────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS printify_product_id TEXT,
  -- Printify prices and ships a VARIANT (a size/colour), not a product, so the
  -- variant is what an order line has to name. One marketplace product = one
  -- Printify variant; a second size is a second row, which keeps the cart, the
  -- price and the fulfillment call all addressing the same thing.
  ADD COLUMN IF NOT EXISTS printify_variant_id TEXT,
  ADD COLUMN IF NOT EXISTS printify_shop_id TEXT;

CREATE INDEX IF NOT EXISTS products_printify_idx ON products (member_id, printify_product_id);

COMMENT ON COLUMN products.printify_variant_id IS
  'The Printify variant this row sells. Required to quote shipping and to submit an order line.';

-- ── Orders ───────────────────────────────────────────────────────────────────
-- Printify is a third delivery provider, reusing the delivery columns rather
-- than growing a parallel set: it takes an address and charges a fee, exactly
-- like the other two. What differs is who acts and who keeps the fee —
--   uber     → platform dispatches a courier, platform keeps the fee
--   self     → vendor drives,                 vendor keeps the fee
--   printify → Printify prints and ships,     VENDOR keeps the fee (they are
--              the one Printify bills for production and postage)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_provider_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_delivery_provider_check
  CHECK (delivery_provider IS NULL OR delivery_provider IN ('uber', 'self', 'printify'));

-- What Printify called this order, so a vendor can find it in their dashboard
-- and so the push is idempotent against a webhook retry.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS printify_order_id TEXT;

COMMENT ON COLUMN orders.delivery_provider IS
  'uber | self | printify, set at payment time. NULL on pickup/ticket/digital/service orders. Decides who fulfils it AND who kept the fee: only uber routes the fee to the platform.';
