-- Shopper lists — "Coffee crawl", "Take mum here", "Saturday errands".
--
-- Lists were localStorage-only (lib/shopper-lists.ts, the `wl_shopper_lists`
-- key). That made "My lists" a promise the software didn't keep: the lists
-- vanished on a second device and on any cleared site data. They persist here
-- now, and the local copy stays only as the signed-out draft, merged up on the
-- next sign-in.
--
-- member_ids is an ARRAY, not a join table — unlike saved_members, which is a
-- row per bookmark. A bookmark is asked about one business at a time ("is this
-- one saved?", across ~80 cards); a list is only ever read whole, and the order
-- inside it is the user's own. A join table would buy nothing here and cost an
-- aggregate on every read.
--
-- member_id values are TEXT for the same reason as saved_members: directory
-- members arrive from the connector as `pliq_361` alongside real uuids, so a
-- uuid[] would make most of the directory un-listable.

CREATE TABLE IF NOT EXISTS shopper_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,              -- clerk_user_id
  name text NOT NULL,
  member_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The only read: "give me my lists, newest first".
CREATE INDEX IF NOT EXISTS shopper_lists_user_idx
  ON shopper_lists (user_id, created_at DESC);

-- One list per name per person, case-insensitive. This is what makes the
-- localStorage merge idempotent: signing in on a third device re-sends the
-- same names and must not produce three "Coffee crawl" lists.
CREATE UNIQUE INDEX IF NOT EXISTS shopper_lists_user_name_idx
  ON shopper_lists (user_id, lower(name));

ALTER TABLE shopper_lists ENABLE ROW LEVEL SECURITY;
-- Written only via the service-role key, from Clerk-authenticated server
-- routes. A table created through the Management API inherits no grants.
GRANT ALL ON shopper_lists TO service_role;
