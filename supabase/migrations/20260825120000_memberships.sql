-- Memberships: a business sells a recurring membership; a shopper holds it.
--
-- This is the vendor's OWN subscription product, sold to their customers. It is
-- NOT the platform plan in `subscriptions` (Free/Member/Pro — what a business
-- pays US). The two are both Stripe subscriptions and arrive through the same
-- webhook, so every row here is tagged `kind: membership` in Stripe metadata and
-- the platform handler refuses anything it doesn't recognise. Without that
-- fence, a business owner joining another business's membership would resolve
-- to their own member_id by customer lookup and downgrade the Pro plan they pay
-- for. See lib/subscriptions.ts.
--
-- ⚠️ PERKS ARE REAL-WORLD ONLY, and that is an App Store constraint, not taste.
-- Apple 3.1.1 demands In-App Purchase for anything unlocking DIGITAL content in
-- the app; 3.1.3(e) explicitly allows goods and services consumed OUTSIDE it on
-- a normal card — which is why tickets and bookings already sell on Stripe here.
-- A discount at the counter, a free pastry, early access to a real event are all
-- outside-the-app. There is deliberately no "members-only download" perk: adding
-- one drags every membership into IAP and Apple's 30%.

CREATE TABLE IF NOT EXISTS membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The business selling it.
  member_id text NOT NULL,

  name text NOT NULL,
  description text,

  price_cents integer NOT NULL CHECK (price_cents > 0),
  -- Stripe's own vocabulary, so it maps straight onto a recurring price.
  billing_interval text NOT NULL DEFAULT 'month'
    CHECK (billing_interval IN ('month', 'year')),

  -- The ONE perk the code enforces: taken off the items subtotal at checkout by
  -- the server, never by the client. NULL or 0 = this tier gives no discount.
  discount_percent integer CHECK (discount_percent IS NULL OR (discount_percent BETWEEN 1 AND 100)),

  -- Everything else the member gets, as plain lines the business writes and
  -- honours in person: ["A free pastry each month", "Members-only Sunday hours"].
  -- Text, not a rules engine — we display these, we do not police them.
  perks jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Created lazily on the PLATFORM account (these are destination charges, so
  -- the price lives with us and the money is transferred to the vendor).
  stripe_price_id text,

  -- Retiring a tier must not cancel the people already on it, so this only
  -- hides it from the join screen.
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS membership_plans_member_idx ON membership_plans (member_id, active, sort_order);

-- One shopper's membership of one business.
CREATE TABLE IF NOT EXISTS memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES membership_plans (id) ON DELETE RESTRICT,
  -- Denormalised so the vendor's member list and the checkout discount lookup
  -- are one indexed read and never a join through a plan that may be retired.
  member_id text NOT NULL,

  -- The subscriber. Clerk only: a renewal needs someone to renew FOR, so unlike
  -- a one-off sale this cannot be a guest.
  clerk_user_id text NOT NULL,
  subscriber_email text,
  subscriber_name text,

  -- Stripe's status verbatim: active | trialing | past_due | canceled |
  -- incomplete | incomplete_expired | unpaid. `active` and `trialing` are the
  -- only two that mean "give them the perks".
  status text NOT NULL DEFAULT 'incomplete',
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  current_period_end timestamptz,

  -- Price at the moment they joined. A tier's price may change later; what this
  -- person actually pays is whatever Stripe keeps charging, so the vendor's MRR
  -- has to be summed from here, not from the plan.
  price_cents integer NOT NULL DEFAULT 0,
  billing_interval text NOT NULL DEFAULT 'month',

  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,

  started_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The vendor's member list.
CREATE INDEX IF NOT EXISTS memberships_member_idx ON memberships (member_id, status);
-- The shopper's "my memberships", and the checkout discount lookup.
CREATE INDEX IF NOT EXISTS memberships_user_idx ON memberships (clerk_user_id, status);
-- One live membership per person per business. Partial, so a cancelled one
-- doesn't block re-joining later.
CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_active_idx
  ON memberships (clerk_user_id, member_id)
  WHERE status IN ('active', 'trialing', 'past_due');

-- Service-role only: these rows carry who pays whom. Nothing client-side ever
-- reads them directly; every read goes through an API route that has already
-- established who is asking.
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Grants must be explicit. A table created through the Management API does not
-- pick up the default privileges the CLI's role would have applied, so without
-- this the service role gets "permission denied" on its own tables.
--
-- service_role ONLY, deliberately: `anon` and `authenticated` are the browser's
-- keys, and these rows say who pays whom. Every read already goes through an API
-- route that has established who is asking.
GRANT SELECT, INSERT, UPDATE, DELETE ON membership_plans TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON memberships TO service_role;
REVOKE ALL ON membership_plans FROM anon, authenticated;
REVOKE ALL ON memberships FROM anon, authenticated;
