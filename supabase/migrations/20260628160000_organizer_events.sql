-- Organizer toolkit: event-scoped invites (vendor lineup) + an event message
-- thread (group chat / announcements / SMS+email blast log).
-- Events themselves reuse the existing `vendor_events` table (host = organizer's
-- member_id); the lineup = accepted event-scoped invites.

-- Scope the collab invite system to an event (lineup) vs a generic 1:1 collab.
ALTER TABLE collab_invites ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'collab'; -- collab | event
ALTER TABLE collab_invites ADD COLUMN IF NOT EXISTS scope_id text;   -- event id when scope_type='event'
ALTER TABLE collab_invites ADD COLUMN IF NOT EXISTS role text;       -- e.g. 'vendor', 'food', 'music'
CREATE INDEX IF NOT EXISTS collab_invites_scope_idx ON collab_invites (scope_type, scope_id, status);

-- Event group thread: in-app chat + a log of SMS/email blasts the organizer sent.
CREATE TABLE IF NOT EXISTS event_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  sender_id text NOT NULL,
  sender_name text,
  text text NOT NULL,
  channel text NOT NULL DEFAULT 'chat',   -- chat | sms | email | announcement
  recipients integer,                      -- # contacted, for blast rows
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_messages_event_idx ON event_messages (event_id, created_at);

ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_messages_open ON event_messages FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON event_messages TO anon, authenticated, service_role;
