-- Apple In-App Purchase support on the platform subscriptions table.
--
-- iOS subscriptions are sold via StoreKit (Apple 3.1.1 forbids Stripe for
-- digital subs in-app). An Apple purchase lands in the SAME `subscriptions`
-- table (keyed by member_id) so `getEntitlements()` reads one source of truth
-- regardless of whether the plan was bought on the web (Stripe) or in the iOS
-- app (Apple). These columns are the Apple analogues of the stripe_* ones.
--   source                        : 'stripe' | 'apple' — which store owns this row
--   apple_original_transaction_id : Apple's stable subscription id (survives renewals)
--   apple_product_id              : e.g. ai.whatslocal.pro.monthly
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'stripe',
  ADD COLUMN IF NOT EXISTS apple_original_transaction_id text,
  ADD COLUMN IF NOT EXISTS apple_product_id text;

-- App Store Server Notifications arrive with only the originalTransactionId, so
-- we resolve the member row by it (mirrors subscriptions_customer_idx for Stripe).
CREATE INDEX IF NOT EXISTS subscriptions_apple_txn_idx
  ON subscriptions (apple_original_transaction_id);
