-- Make the scraped-event dedupe key usable as an ON CONFLICT target.
--
-- 20260804120000 created this index as PARTIAL (`WHERE source_id IS NOT NULL`),
-- which Postgres will only match to an upsert if the statement repeats the same
-- predicate — something the Supabase client cannot emit. Every upsert failed
-- with "no unique or exclusion constraint matching the ON CONFLICT
-- specification".
--
-- A plain unique index is the right tool anyway: Postgres treats NULLs as
-- distinct in a unique index, so the in-app events (source_id and external_uid
-- both NULL) never collide with each other, and the partial predicate was
-- buying nothing.

DROP INDEX IF EXISTS vendor_events_source_uid_idx;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_events_source_uid_idx
  ON vendor_events (source_id, external_uid);
