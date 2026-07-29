-- User-generated-content moderation (App Store guideline 1.2). WhatsLocal has
-- UGC (share posts + the "memories" walls). Apple requires: report objectionable
-- content, block abusive users (instant removal from the blocker's feed + notify
-- the developer), and a takedown path acted on within 24h. This adds the tables
-- + a moderation flag on posts.

-- A user flags a post as objectionable. status: pending -> actioned | dismissed.
CREATE TABLE IF NOT EXISTS content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  reporter_id text NOT NULL,        -- clerk_user_id of the reporter
  author_id text,                   -- clerk_user_id of the post's author
  reason text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_reports_status_idx ON content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_post_idx ON content_reports (post_id);

-- A user blocks another user. The blocker never sees the blocked user's content
-- again (filtered server-side). PK prevents duplicate rows.
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id text NOT NULL,   -- clerk_user_id doing the blocking
  blocked_id text NOT NULL,   -- clerk_user_id being blocked
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON user_blocks (blocker_id);

-- Moderator/takedown flag: a removed post is hidden from every feed globally.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS removed boolean NOT NULL DEFAULT false;

-- An ejected author: all their posts are removed and they can't be surfaced.
CREATE TABLE IF NOT EXISTS banned_authors (
  author_id text PRIMARY KEY,   -- clerk_user_id
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE banned_authors ENABLE ROW LEVEL SECURITY;
-- Written only via the service-role key (server routes); no anon access.
GRANT ALL ON content_reports, user_blocks, banned_authors TO service_role;
