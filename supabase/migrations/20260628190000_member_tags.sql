-- Organizer-scoped tags for grouping businesses you onboard (e.g. "farmers
-- market", "ghirardelli square"). Lets you pull up everyone with a tag and
-- bulk-add them to an event lineup. Scoped by owner (the organizer's member id)
-- so each organizer manages their own groups.
CREATE TABLE IF NOT EXISTS member_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id text NOT NULL,          -- the organizer who applied the tag
  member_id text NOT NULL,          -- the tagged business
  member_name text,                 -- denormalized for listing
  tag_slug text NOT NULL,           -- normalized key, e.g. "farmers-market"
  tag_label text NOT NULL,          -- display label, e.g. "Farmers Market"
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, member_id, tag_slug)
);
CREATE INDEX IF NOT EXISTS member_tags_owner_idx ON member_tags (owner_id, tag_slug);

ALTER TABLE member_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_tags_open ON member_tags FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON member_tags TO anon, authenticated, service_role;
