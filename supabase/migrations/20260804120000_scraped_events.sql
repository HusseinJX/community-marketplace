-- Scraped community events (see scraping.md + lib/sources/).
--
-- Events harvested from watched public calendars land in the SAME table as
-- in-app organizer events, so every downstream reader (feed, event page, RSVP,
-- map) works on them for free. These columns are what a scraped row needs that
-- a hand-created one never did.
--
-- The unique index is the important one: the sweep re-reads each source on a
-- cadence, so without a stable key every weekly run would insert a fresh copy
-- of all ~800 events. Upsert on (source_id, external_uid) makes a re-run
-- idempotent — it refreshes rows in place instead of multiplying them.

-- Which watched source produced this row (registry id: 'sfpl', 'funcheap', …).
-- NULL for everything created in-app, which is how the two kinds stay separable
-- in queries without a second table.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS source_id TEXT;

-- The source's own stable id (ICS UID, API id, slug) — the scraper's primary
-- dedupe key, carried through so re-scrapes match existing rows.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS external_uid TEXT;

-- Link back to the event on the source site. For scraped events this is the
-- only "canonical" page there is — the host is not a member with a profile.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS event_url TEXT;

-- Multi-day events (exhibitions, runs) need an end date or they collapse to a
-- single day and disappear from the feed the day after they open — the exact
-- bug the scraper's isCurrent() guards against upstream.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS end_date TEXT;

-- Idempotent re-scrapes.
--
-- NOT partial: a partial unique index cannot serve as an ON CONFLICT target
-- unless the statement repeats its predicate, which the Supabase client cannot
-- do. Superseded by 20260804130000 — kept here so the history reads straight.
-- NULLs are distinct in a Postgres unique index, so in-app events (both columns
-- NULL) never collide.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_events_source_uid_idx
  ON vendor_events (source_id, external_uid);

-- The feed sorts by date and filters out finished events; without this it is a
-- sequential scan over every scraped row on each request.
CREATE INDEX IF NOT EXISTS vendor_events_active_date_idx
  ON vendor_events (active, event_date);
