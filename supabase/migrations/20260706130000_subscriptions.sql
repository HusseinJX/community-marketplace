-- Platform subscriptions: a business (member) pays WhatsLocal for a plan. This is
-- SEPARATE from stripe_connect_accounts (which is vendor payouts). One row per
-- member; absence of a row = free (unclaimed listing).
--   plan   : free | member | pro | enterprise
--   status : active | trialing | past_due | canceled | inactive
-- The capability matrix + numeric limits per plan live in lib/entitlements.ts so
-- they can change without a migration.
CREATE TABLE IF NOT EXISTS subscriptions (
  member_id text PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'inactive',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_customer_idx ON subscriptions (stripe_customer_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_open ON subscriptions FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON subscriptions TO anon, authenticated, service_role;
