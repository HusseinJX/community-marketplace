-- "Outing" invites: a host fires several individual 1:1 invites for the SAME
-- occasion (e.g. "Beach day") to gauge who's in, each staying a private DM/room.
-- The invites share an occasion_id + occasion_label so the Sent tab rolls them up
-- ("4 invited · 2 in"); the host can later promote the accepters into a group room.
ALTER TABLE collab_invites ADD COLUMN IF NOT EXISTS occasion_id text;
ALTER TABLE collab_invites ADD COLUMN IF NOT EXISTS occasion_label text;
CREATE INDEX IF NOT EXISTS collab_invites_occasion_idx ON collab_invites (from_id, occasion_id);
