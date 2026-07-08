-- Security hardening: close the wide-open access on private + money tables.
--
-- The original migrations created these tables with `GRANT ALL ... TO anon,
-- authenticated` plus a permissive `USING (true)` RLS policy — i.e. anyone
-- holding the project's anon key (a key class conventionally treated as public)
-- could read/write every invite, room, message, post, and subscription directly,
-- bypassing all the API-layer authorization.
--
-- Every real access path in this app is SERVER-SIDE using the service-role key,
-- which bypasses RLS and is unaffected by these grants. So we revoke the
-- anon/authenticated privileges entirely and let the API layer (Clerk + resolveActor
-- + isRoomMember) remain the sole gate, backed by service-role DB access.
--
-- If a browser-side Supabase client is ever added for a genuinely public read,
-- re-grant the minimum (e.g. `GRANT SELECT ON posts TO anon`) in a deliberate
-- follow-up migration — do not restore blanket GRANT ALL.

-- Money / entitlements — a self-inserted row here would grant paid features free.
DROP POLICY IF EXISTS subscriptions_open ON subscriptions;
REVOKE ALL ON subscriptions FROM anon, authenticated;

-- Private collaborator network (invites / rooms / messages).
REVOKE ALL ON collab_invites FROM anon, authenticated;
REVOKE ALL ON collab_rooms FROM anon, authenticated;
REVOKE ALL ON collab_messages FROM anon, authenticated;

-- collab_room_members (added later in 20260628210000_collab_groups) — guard in
-- case this migration runs against a DB that doesn't have it yet.
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'collab_room_members') THEN
    EXECUTE 'REVOKE ALL ON collab_room_members FROM anon, authenticated';
  END IF;
END $$;

-- Social posts — public to READ, but writes must go through the authed API.
-- Reads are server-side (lib/posts.ts, service role), so revoke everything;
-- re-grant SELECT deliberately if a public browser read is ever introduced.
REVOKE ALL ON posts FROM anon, authenticated;
