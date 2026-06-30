-- Collaborator network: a vendor/artist searches the local network and sends a
-- collaboration invite to another member. On accept, a self-contained collab
-- room is created (no dependency on the connector-agent room system).

CREATE TABLE IF NOT EXISTS collab_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id text NOT NULL,                 -- inviter member id
  from_name text,
  to_id text NOT NULL,                    -- invitee member id
  to_name text,
  message text,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | declined
  room_id uuid,                           -- set when accepted
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collab_invites_to_idx ON collab_invites (to_id, status);
CREATE INDEX IF NOT EXISTS collab_invites_from_idx ON collab_invites (from_id, status);

CREATE TABLE IF NOT EXISTS collab_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_a text NOT NULL,
  member_a_name text,
  member_b text NOT NULL,
  member_b_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collab_rooms_a_idx ON collab_rooms (member_a);
CREATE INDEX IF NOT EXISTS collab_rooms_b_idx ON collab_rooms (member_b);

CREATE TABLE IF NOT EXISTS collab_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL,
  sender_id text NOT NULL,
  sender_name text,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collab_messages_room_idx ON collab_messages (room_id, created_at);

ALTER TABLE collab_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY collab_invites_open ON collab_invites FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY collab_rooms_open ON collab_rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY collab_messages_open ON collab_messages FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON collab_invites TO anon, authenticated, service_role;
GRANT ALL ON collab_rooms TO anon, authenticated, service_role;
GRANT ALL ON collab_messages TO anon, authenticated, service_role;
