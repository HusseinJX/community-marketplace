-- "Save for later" on an event — the star on an event card.
--
-- Distinct from an RSVP, and deliberately so. An RSVP is a commitment that
-- issues a real scannable ticket and counts against capacity; a save is a
-- bookmark that promises the organiser nothing. Conflating them would either
-- inflate every "going" count with maybes or force someone to commit before
-- they've decided.
--
-- event_id is TEXT, not a uuid FK to vendor_events. The events feed mixes
-- vendor_events rows with connector-sourced events whose ids are not uuids, and
-- a foreign key would make half the feed unsaveable.

CREATE TABLE IF NOT EXISTS saved_events (
  user_id text NOT NULL,        -- clerk_user_id
  event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One save per person per event; the PK is what makes the toggle idempotent.
  PRIMARY KEY (user_id, event_id)
);

-- The read that happens on every feed render: "which of these did I save?"
CREATE INDEX IF NOT EXISTS saved_events_user_idx ON saved_events (user_id, created_at DESC);

ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;
-- Written only via the service-role key (server routes, Clerk-authenticated).
GRANT ALL ON saved_events TO service_role;
