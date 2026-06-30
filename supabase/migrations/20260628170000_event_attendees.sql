-- Free RSVP / attendees for organizer events (vendor_events). One row per
-- attendee per event; capacity is optional (null = unlimited).
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS capacity integer;

CREATE TABLE IF NOT EXISTS event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  attendee_id text NOT NULL,             -- Clerk user id
  attendee_name text,
  attendee_contact text,                 -- optional email/phone for organizer blasts
  party_size integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'going',  -- going | cancelled
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, attendee_id)
);
CREATE INDEX IF NOT EXISTS event_attendees_event_idx ON event_attendees (event_id, status);

ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_attendees_open ON event_attendees FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON event_attendees TO anon, authenticated, service_role;
