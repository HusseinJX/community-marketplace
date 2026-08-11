-- AI pre-publish moderation for chats + community content.
--
-- The existing UGC stack (20260729130000_ugc_moderation) is REACTIVE: a human
-- reports a post, three reports auto-hide it. That satisfies App Store 1.2 but
-- it means the first few people to see objectionable content are the filter.
-- This adds a proactive pass — every post and chat message is screened by a
-- model at write time, images included — and a log of what it decided.
--
-- The log is the point. A moderation model that silently blocks is impossible
-- to tune and impossible to defend when a member asks why their post vanished,
-- so every non-allow decision lands here with the scores that caused it.

-- One row per screened item that was NOT allowed outright.
--   surface    — where it came from ('post' | 'chat'), so the queue can group.
--   content_id — posts.id, or collab_messages.id. NULL when the write was
--                rejected before insert (a blocked post never gets an id).
--   action     — what the screener decided: 'block' (never published) or
--                'review' (published-but-hidden for a post, delivered-and-
--                flagged for a chat message).
--   status     — the moderator's verdict afterwards: pending -> actioned |
--                dismissed. Mirrors content_reports so one queue can show both.
CREATE TABLE IF NOT EXISTS moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  surface text NOT NULL,
  content_id text,
  author_id text,
  action text NOT NULL,
  categories text[] NOT NULL DEFAULT '{}',
  scores jsonb,
  -- An excerpt, not the whole body: enough for a moderator to judge without
  -- turning this table into a second copy of every message on the platform.
  excerpt text,
  image_count integer NOT NULL DEFAULT 0,
  -- Which input tripped it — a caption can be clean while the photo is not,
  -- and the moderator needs to know which one to look at.
  flagged_images boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_events_status_idx ON moderation_events (status, created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_events_content_idx ON moderation_events (content_id);

-- Held-for-review state on a post.
--
-- Deliberately SEPARATE from `removed`. `removed` means a human decided this
-- post is gone; 'pending' means a model was unsure and nobody has looked yet.
-- Collapsing them would make an unreviewed post indistinguishable from a
-- moderated one in the queue, and a restore would silently launder the first
-- into the second. Both hide the post from feeds — only one is a judgement.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'allowed';

COMMENT ON COLUMN posts.moderation_status IS
  'allowed | pending (AI held it, awaiting a human) | cleared (human said fine). Hidden from feeds while pending; see lib/posts.ts.';

ALTER TABLE moderation_events ENABLE ROW LEVEL SECURITY;
-- Written only via the service-role key (server routes); no anon access.
GRANT ALL ON moderation_events TO service_role;
