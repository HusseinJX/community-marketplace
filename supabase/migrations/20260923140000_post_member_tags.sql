-- Several people in one post.
--
-- `posts.tagged_member_id` is a single column, which was right while a post was
-- "I was at this business". A mural is not: it has two or five artists, and
-- every one of them should find it on their own page. One column cannot say
-- that, and overwriting it with the "main" artist would quietly decide that the
-- others didn't paint it.
--
-- The old column STAYS and stays authoritative for the single-tag case. Every
-- existing post, every existing surface and the whole share composer keep
-- working untouched; reads union the two. Migrating the column away would mean
-- rewriting every caller for a feature that most posts will never use.
--
-- member_id is TEXT for the same reason as saved_members and shopper_lists:
-- connector ids like `pliq_361` sit beside real uuids.

CREATE TABLE IF NOT EXISTS post_member_tags (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  member_id text NOT NULL,
  -- Denormalised so a tag chip can render without hydrating the member. The
  -- name at the time of tagging; the profile is the source of truth if they
  -- ever disagree.
  member_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, member_id)
);

-- The read that makes this worth having: "every artwork this artist is in".
CREATE INDEX IF NOT EXISTS post_member_tags_member_idx
  ON post_member_tags (member_id, created_at DESC);

ALTER TABLE post_member_tags ENABLE ROW LEVEL SECURITY;
-- Written only through the server routes, which check the author and the admin.
GRANT ALL ON post_member_tags TO service_role;
