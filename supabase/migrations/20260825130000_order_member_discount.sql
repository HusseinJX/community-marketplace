-- What a membership took off this order.
--
-- The order's `subtotal_cents` is what the buyer actually PAID, so without these
-- two columns a discounted order is indistinguishable from a cheaper basket —
-- the vendor sees less money arrive with nothing saying why, and the 5% looks
-- wrong against the listed prices. Both are NULL on every order that had no
-- membership behind it, which is the honest reading of "no discount applied".
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_cents integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS member_discount_percent integer;
