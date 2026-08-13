-- "Save" on a business — the bookmark on a shop card and on a profile.
--
-- The sibling of saved_events (20260811130000) and deliberately the same shape:
-- one row per person per business, the pair as the primary key so a toggle is
-- idempotent. Two tables rather than one polymorphic "saved things" table,
-- because an event id and a member id come from different systems and nothing
-- reads them together — a `kind` column would buy one table and cost a filter
-- on every query.
--
-- member_id is TEXT, not a uuid. Directory members come from the connector with
-- ids like `pliq_361` alongside real uuids, so a uuid column would make most of
-- the directory unsaveable — the same reason saved_events.event_id is text.

CREATE TABLE IF NOT EXISTS saved_members (
  user_id text NOT NULL,        -- clerk_user_id
  member_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, member_id)
);

-- The read that happens on every directory render: "which of these did I save?"
CREATE INDEX IF NOT EXISTS saved_members_user_idx ON saved_members (user_id, created_at DESC);

ALTER TABLE saved_members ENABLE ROW LEVEL SECURITY;
-- Written only via the service-role key (server routes, Clerk-authenticated).
GRANT ALL ON saved_members TO service_role;
