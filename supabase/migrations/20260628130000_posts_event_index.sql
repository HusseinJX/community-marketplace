-- Index for the event/broadcast "memories" view (getPostsByEventId).
-- The original posts migration only indexed tagged_member_id.
CREATE INDEX IF NOT EXISTS posts_tagged_event_idx ON posts (tagged_event_id, created_at DESC);
