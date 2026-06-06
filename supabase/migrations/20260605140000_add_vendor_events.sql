-- Self-serve / AI-captured events owned by this marketplace app.
-- (Connector-agent events are harvested and read-only, so new events with
-- poster images live here.) Mirrors the products draft model: active=false is a
-- draft pending approval; active=true is live.
CREATE TABLE vendor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL,
  member_name TEXT,
  title TEXT NOT NULL,
  description TEXT,
  event_date TEXT,              -- freeform to match connector event date strings
  event_time TEXT,
  location TEXT,
  poster_image_url TEXT,        -- the original flyer/poster image
  source TEXT NOT NULL DEFAULT 'manual',  -- manual | ai_flyer
  active BOOLEAN NOT NULL DEFAULT true,    -- false = draft pending approval
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX vendor_events_member_idx ON vendor_events (member_id);

ALTER TABLE vendor_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor_events_open" ON vendor_events FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON vendor_events TO anon, authenticated, service_role;
