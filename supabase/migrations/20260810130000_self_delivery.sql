-- Vendor-handled delivery: the business drives it themselves, on their own terms.
--
-- Until now "delivery" meant exactly one thing — dispatch an Uber courier — so a
-- vendor who already delivers (most local food businesses do) had no way to say
-- so, and every customer saw pickup only. Uber is also blocked on account
-- activation, which means today NOBODY can offer delivery at all.
--
-- THE MONEY IS THE POINT, and it differs from Uber in one decisive way:
--   uber → the PLATFORM pays the courier, so the fee routes to the platform
--   self → the VENDOR does the driving, so the fee routes to the VENDOR
-- Reusing the Uber branch here would skim every self-delivering vendor's fee.
-- Platform still takes 5% of ITEMS only, never of the delivery fee — the same
-- "don't tax a pass-through" rule the Uber path already follows.

-- delivery_mode replaces the uber_direct_enabled boolean as the source of truth.
-- The boolean stays (it's read by existing code and by the Uber paths) and is
-- kept in step on write, rather than being dropped in the same migration that
-- introduces its replacement.
ALTER TABLE vendor_settings
  ADD COLUMN IF NOT EXISTS delivery_mode TEXT NOT NULL DEFAULT 'none';

-- Existing opted-in vendors are Uber vendors — that was the only kind.
UPDATE vendor_settings
   SET delivery_mode = 'uber'
 WHERE uber_direct_enabled = true
   AND delivery_mode = 'none';

ALTER TABLE vendor_settings DROP CONSTRAINT IF EXISTS vendor_settings_delivery_mode_check;
ALTER TABLE vendor_settings
  ADD CONSTRAINT vendor_settings_delivery_mode_check
  CHECK (delivery_mode IN ('none', 'self', 'uber'));

-- The vendor's own pricing rules. Flat fee + two optional modifiers, which is
-- what small businesses actually run: "£4 delivery, free over £40, £15 minimum".
ALTER TABLE vendor_settings
  ADD COLUMN IF NOT EXISTS self_delivery_fee_cents INTEGER NOT NULL DEFAULT 0,
  -- Subtotal at or above this → delivery is free. NULL = never free.
  ADD COLUMN IF NOT EXISTS self_delivery_free_over_cents INTEGER,
  -- Below this subtotal → delivery isn't offered at all (pickup still is).
  ADD COLUMN IF NOT EXISTS self_delivery_min_order_cents INTEGER,
  -- Coverage as POSTAL CODES, not a radius.
  --
  -- A radius reads better on a form but needs the buyer's address geocoded on
  -- every checkout — a billed Google request per attempt, against the spending
  -- rules in lib/places.ts — and it is fuzzy exactly where it matters (5 miles
  -- across the bay is not 5 miles of driving). ZIPs cost nothing, are exact,
  -- and are how a shop owner already thinks about their round.
  --
  -- EMPTY OR NULL MEANS ANYWHERE. That's the zero-typing default: a vendor
  -- turning delivery on shouldn't have to enumerate their city before their
  -- first order, and the ones who care can be precise.
  ADD COLUMN IF NOT EXISTS self_delivery_zips TEXT[],
  -- Free text shown to the buyer before they pay: "Tue & Thu evenings only".
  -- Days/time windows are deliberately NOT modelled — a scheduling system is a
  -- real subsystem, and a sentence the vendor writes is honest in the meantime.
  ADD COLUMN IF NOT EXISTS self_delivery_notes TEXT;

COMMENT ON COLUMN vendor_settings.delivery_mode IS
  'none | self (vendor drives, fee goes to the vendor) | uber (platform dispatches a courier, fee goes to the platform). Source of truth; uber_direct_enabled is kept in step for legacy readers.';
COMMENT ON COLUMN vendor_settings.self_delivery_zips IS
  'Postal codes this vendor delivers to. NULL or empty = anywhere (the default).';

-- Which kind of delivery an order actually was. Without this the vendor
-- dashboard cannot tell a "dispatch a courier" order from a "put it in my car"
-- order, and would offer an Uber dispatch button on both.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_provider TEXT;

-- Every existing delivery order predates self-delivery, so it was an Uber one.
UPDATE orders
   SET delivery_provider = 'uber'
 WHERE fulfillment_type = 'delivery'
   AND delivery_provider IS NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_provider_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_delivery_provider_check
  CHECK (delivery_provider IS NULL OR delivery_provider IN ('uber', 'self'));

COMMENT ON COLUMN orders.delivery_provider IS
  'uber | self, set at payment time. NULL on pickup/ticket orders. `dispatched` means "courier collected it" for uber and "vendor is out delivering it" for self — same status, different actor.';
