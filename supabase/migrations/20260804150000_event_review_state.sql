-- Review state for scraped event drafts.
--
-- Recipe-pattern sources (hand-written selectors) land as `active = false` for
-- a human to read before they reach the feed. Until now that was the ONLY
-- signal, which made "nobody has looked at this yet" and "a reviewer said no"
-- indistinguishable — so a rejection could not be recorded at all, and deleting
-- the row was worse than useless: the next sweep re-inserts it as a fresh draft
-- and the same event comes back every week forever.
--
-- `reviewed_at` is the missing half. Pending means active = false AND
-- reviewed_at IS NULL. Both decisions stamp it, so a "no" survives re-scrapes.
--
-- Nothing in the sweep writes this column: persistScraped() builds its payload
-- from toRow(), and an upsert only overwrites the columns it is given. So a
-- reviewer's decision outlives every future scrape, the same way `active`
-- already does for review sources.
alter table vendor_events
  add column if not exists reviewed_at timestamptz;

comment on column vendor_events.reviewed_at is
  'When a human decided this scraped draft''s fate. NULL = still pending review. Set on both approve and reject so a rejection is not re-offered after the next sweep.';

-- The review queue is the only reader, and it is always the same question:
-- which drafts has nobody ruled on. Partial, so it stays tiny (tens of rows)
-- rather than indexing all ~800 scraped events.
create index if not exists vendor_events_pending_review_idx
  on vendor_events (source_id, event_date)
  where active = false and reviewed_at is null;
