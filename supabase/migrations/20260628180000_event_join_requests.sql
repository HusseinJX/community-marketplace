-- Onboarding at a pre-tagged venue/event: vendors whose business isn't in the
-- directory yet submit a request via the event join link. The organizer reviews
-- them; actually creating the member happens in the connector-agent (separate).
CREATE TABLE IF NOT EXISTS event_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  name text NOT NULL,
  category text,
  contact text,                          -- email or phone
  note text,
  status text NOT NULL DEFAULT 'pending', -- pending | added | dismissed
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_join_requests_event_idx ON event_join_requests (event_id, status);

ALTER TABLE event_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_join_requests_open ON event_join_requests FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON event_join_requests TO anon, authenticated, service_role;
