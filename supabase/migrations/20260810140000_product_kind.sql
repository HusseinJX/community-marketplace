-- What KIND of thing is being sold.
--
-- `products` has only ever described a physical good, so a vendor listing
-- "1-hour consultation, $100" (the seed data already sells one) takes real
-- money and then tells the buyer to "Pick up" and the vendor to "Mark Ready".
-- Nothing in the schema distinguishes a consultation from a loaf of bread.
--
-- This one column is also the gate on two queued features: a digital download
-- and a print-on-demand item both need to be told apart from something the
-- customer collects from a counter. Adding it now is one migration; adding it
-- after those exist means retrofitting every fulfillment path.
--
--   good    → a physical thing. Pickup or delivery. (The default, and what
--             every existing row is.)
--   service → the business performs it. Nothing to hand over, nothing to
--             deliver. NOT a booking — scheduling is a separate subsystem that
--             does not exist yet; this just stops us lying about fulfillment.
--   digital → a file the buyer downloads. Delivered automatically on payment.
--   ticket  → admission to an event. Lives in event_tickets; here so the
--             vocabulary is complete and a POS import can be classified.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'good';

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_kind_check;
ALTER TABLE products
  ADD CONSTRAINT products_kind_check
  CHECK (kind IN ('good', 'service', 'digital', 'ticket'));

COMMENT ON COLUMN products.kind IS
  'good (default, physical) | service (performed, no handover) | digital (file, auto-delivered) | ticket. Decides which fulfillment path an order can take.';

CREATE INDEX IF NOT EXISTS products_kind_idx ON products (member_id, kind);

-- An order can now be fulfilled by doing nothing physical at all.
--
--   digital → delivered the moment payment lands; there is no vendor action,
--             so it must never sit in a queue waiting for one.
--   service → the vendor performs it and marks it done. `collected` would be
--             the wrong word for an hour of someone's time.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_fulfillment_type_check
  CHECK (fulfillment_type IN ('pickup', 'delivery', 'ticket', 'digital', 'service'));

COMMENT ON COLUMN orders.status IS
  'paid | ready | collected (pickup) | dispatched | delivered (delivery, digital) | completed (service) | refunded';

COMMENT ON COLUMN orders.fulfillment_type IS
  'pickup | delivery | ticket | digital | service. Chosen before payment and derived from what is in the basket: a basket of only digital items has nothing to collect, and a service has nobody to collect from.';
