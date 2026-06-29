-- ❤️ reactions on share posts / memories. The first "return trigger": when your
-- memory gets reactions you get pulled back. One reaction per user per post.
CREATE TABLE IF NOT EXISTS post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  clerk_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, clerk_user_id)
);
CREATE INDEX IF NOT EXISTS post_reactions_post_idx ON post_reactions (post_id);

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY post_reactions_open ON post_reactions FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON post_reactions TO anon, authenticated, service_role;
