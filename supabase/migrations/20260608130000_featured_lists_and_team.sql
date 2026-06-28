-- Team allegiance on a broadcast: which club/country the venue is rooting for
-- (optional). Lets shoppers find "the Mexican bar showing the match that
-- supports Mexico", not just any venue showing it.
ALTER TABLE broadcasts ADD COLUMN supports_team TEXT;
CREATE INDEX broadcasts_team_idx ON broadcasts (supports_team) WHERE supports_team IS NOT NULL;

-- Admin-curated home-screen collections, e.g. "Where to watch the NBA Finals
-- near you". Each list features one event (+ optional team) and is populated at
-- render time from live broadcasts; admins may also pin specific venues that
-- always show it via member_ids.
CREATE TABLE featured_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  event_slug TEXT,                          -- curated event slug (nba, world-cup, ...)
  supports_team TEXT,                        -- optional team filter for the list
  member_ids TEXT[] NOT NULL DEFAULT '{}',   -- pinned venues, always shown
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX featured_lists_order_idx ON featured_lists (active, sort_order);

ALTER TABLE featured_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "featured_lists_open" ON featured_lists FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON featured_lists TO anon, authenticated, service_role;
