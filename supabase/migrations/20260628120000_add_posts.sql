-- Social "share" posts (Twitter/IG-style): text + media, optional tagged
-- business or event, optional livestream link. Mirrors the broadcasts
-- grant/RLS model (open policy + explicit grants to anon/authenticated).

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id text NOT NULL,
  author_name text,
  body text,
  image_urls text[] DEFAULT '{}',
  video_urls text[] DEFAULT '{}',
  tagged_member_id text,
  tagged_member_name text,
  tagged_event_id text,
  tagged_event_title text,
  livestream_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX posts_created_idx ON posts (created_at DESC);
CREATE INDEX posts_tagged_member_idx ON posts (tagged_member_id);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_open" ON posts FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON posts TO anon, authenticated, service_role;
