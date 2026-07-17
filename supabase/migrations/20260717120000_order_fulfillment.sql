-- Fulfillment: pickup vs delivery.
--
-- Until now the only modeled path was delivery. `DeliveryRequestModal` fired
-- after EVERY payment (nothing read vendor_settings.uber_direct_enabled), its
-- "Skip — I'll pick it up" button just closed the dialog without writing
-- anything, and pickup orders stranded at `ready` forever because the only
-- follow-on action (Confirm Delivered) requires `dispatched`.
--
-- fulfillment_type makes the buyer's choice a real, queryable fact, captured
-- BEFORE payment (so the delivery fee can actually be charged) rather than
-- guessed at afterwards.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS fulfillment_type TEXT NOT NULL DEFAULT 'pickup';

-- Existing rows: delivery_requested is the only signal we have about intent.
UPDATE orders
   SET fulfillment_type = 'delivery'
 WHERE delivery_requested = true
   AND fulfillment_type <> 'delivery';

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_fulfillment_type_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_fulfillment_type_check
  CHECK (fulfillment_type IN ('pickup', 'delivery'));

-- What the buyer was actually charged for delivery, frozen at payment time.
-- delivery_fee_cents is the live/most-recent quote; this is the receipt. Uber
-- quotes expire in 15 minutes, so dispatch re-quotes and the two can differ —
-- the platform absorbs the delta, and this column is what makes that visible.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_fee_charged_cents INTEGER;

-- Status gains `collected`: the pickup terminal state. Lifecycle is now
--   paid → ready → collected                  (pickup)
--   paid → ready → dispatched → delivered     (delivery)
--   → refunded (any)
-- `status` is free-text (no CHECK constraint), so nothing to alter — this
-- comment is the contract.
COMMENT ON COLUMN orders.status IS
  'paid | ready | collected (pickup) | dispatched | delivered (delivery) | refunded';

COMMENT ON COLUMN orders.fulfillment_type IS
  'pickup (default) | delivery. Chosen by the buyer before payment; delivery is only offered when the vendor has uber_direct_enabled AND the platform has Uber credentials.';

CREATE INDEX IF NOT EXISTS orders_fulfillment_type_idx ON orders (fulfillment_type);
