-- Community giving: a vendor logs an open-ended gift (funds, goods, time, etc.)
-- to a community org. The org confirms it; once confirmed the vendor earns a
-- public "Gives back" credit shown on their profile so shoppers see it.
CREATE TABLE IF NOT EXISTS community_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id text NOT NULL,                 -- giver (member id)
  vendor_name text,                        -- denormalized for fast rendering
  org_id text NOT NULL,                     -- community org (organizer member id)
  org_name text,                            -- denormalized
  kind text NOT NULL DEFAULT 'other',       -- funds | goods | time | other
  description text NOT NULL,                -- "50 loaves weekly", "$500 to rent fund"
  amount_cents integer,                     -- optional, for funds
  status text NOT NULL DEFAULT 'pending',   -- pending | confirmed | declined
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_contributions_vendor_idx ON community_contributions (vendor_id, status);
CREATE INDEX IF NOT EXISTS community_contributions_org_idx ON community_contributions (org_id, status);

ALTER TABLE community_contributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY community_contributions_open ON community_contributions FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON community_contributions TO anon, authenticated, service_role;
