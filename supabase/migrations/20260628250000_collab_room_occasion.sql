-- Tie a group room to a named "collaboration" (occasion) so individual invites
-- and the group share one container. A collaboration = occasion_id; its group
-- invites all land in the single occasion-tagged group room, and event_id marks
-- whether the collaboration has been turned into an event.
ALTER TABLE collab_rooms ADD COLUMN IF NOT EXISTS occasion_id text;
ALTER TABLE collab_rooms ADD COLUMN IF NOT EXISTS occasion_label text;
ALTER TABLE collab_rooms ADD COLUMN IF NOT EXISTS event_id text;
CREATE INDEX IF NOT EXISTS collab_rooms_occasion_idx ON collab_rooms (owner_id, occasion_id);
