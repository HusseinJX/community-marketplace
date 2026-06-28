-- "Live Now" broadcasts: a venue announces what it's showing RIGHT NOW
-- (the game, the World Cup, etc.) with a real time window so it auto-appears
-- on /live and auto-expires. Shoppers react via broadcast_saves.
--
-- Mirrors the vendor_events grant/RLS model (open policy + explicit grants to
-- anon, since vendor write paths use the anon key).
CREATE TABLE broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id TEXT NOT NULL,
  member_name TEXT,
  event_slug TEXT NOT NULL,          -- curated picklist slug (nba, world-cup, ...)
  event_label TEXT,                  -- display label (denormalized; supports custom "other")
  whats_on TEXT,                     -- the specific matchup, e.g. "Lakers vs Celtics"
  note TEXT,                         -- optional one-liner ("big screen, sound on, drink specials")
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,      -- when the broadcast stops being "live"
  -- denormalized from the member profile at creation time so /live + the map
  -- render without an N+1 fetch back to the connector for every card.
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  neighborhood TEXT,
  city TEXT,
  active BOOLEAN NOT NULL DEFAULT true,  -- false = manually ended / hidden
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX broadcasts_member_idx ON broadcasts (member_id);
CREATE INDEX broadcasts_event_idx ON broadcasts (event_slug);
CREATE INDEX broadcasts_live_idx ON broadcasts (ends_at) WHERE active;

ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "broadcasts_open" ON broadcasts FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON broadcasts TO anon, authenticated, service_role;

-- Shopper reactions: "save / I'm interested" on a broadcast.
CREATE TABLE broadcast_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, clerk_user_id)
);
CREATE INDEX broadcast_saves_user_idx ON broadcast_saves (clerk_user_id);
CREATE INDEX broadcast_saves_broadcast_idx ON broadcast_saves (broadcast_id);

ALTER TABLE broadcast_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "broadcast_saves_open" ON broadcast_saves FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON broadcast_saves TO anon, authenticated, service_role;
