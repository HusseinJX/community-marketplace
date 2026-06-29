-- Multi-party collab rooms (group collaborations that can become an event).
-- A vendor/artist (or admin matchmaker) groups several parties into one room;
-- each party signals "I'm in" (agreed). The host's "Plan an event" then adds
-- everyone who agreed to the event lineup; non-agreers are simply left off.
--
-- 1:1 rooms stay as-is (is_group=false, members tracked by member_a/member_b).
-- Group rooms set is_group=true + owner_id and track membership in the new
-- collab_room_members table. collab_invites.room_id (already present) points a
-- group invite at its target room so accepting joins that room.

ALTER TABLE collab_rooms ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;
ALTER TABLE collab_rooms ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE collab_rooms ADD COLUMN IF NOT EXISTS owner_id text;

CREATE TABLE IF NOT EXISTS collab_room_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  member_id text NOT NULL,
  member_name text,
  agreed boolean NOT NULL DEFAULT false,  -- "I'm in" for turning this into an event
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, member_id)
);
CREATE INDEX IF NOT EXISTS collab_room_members_room_idx ON collab_room_members (room_id);
CREATE INDEX IF NOT EXISTS collab_room_members_member_idx ON collab_room_members (member_id);

ALTER TABLE collab_room_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY collab_room_members_open ON collab_room_members FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON collab_room_members TO anon, authenticated, service_role;
