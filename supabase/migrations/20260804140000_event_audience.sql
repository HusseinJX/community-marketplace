-- Who each event is for — the data personalisation and filtering need.
--
-- Two groups of columns, from two different places:
--
--   SCRAPED FACTS (tags, free, access) come free with the parse. They were
--   being thrown away at insert, which is why the live feed can only filter by
--   nothing at all.
--
--   AUDIENCE LABELS (topics, energy, ideal_audience, audience) are produced by
--   a model ONCE per event at ingest (~$0.11 for 796). That timing is the whole
--   economic argument: the feed can be personalised per person per request
--   while the model never runs per request.
--
-- Nulls are meaningful here and must stay allowed. The labeller is instructed
-- to return null rather than guess, because a confidently wrong "kidsWelcome"
-- sends a family to the wrong room — worse than admitting we don't know.

-- ── from the scrape ──────────────────────────────────────────────────────────

-- The source's own tags, kept verbatim. Each source has its own vocabulary
-- (SFPL "Book Clubs", Fort Mason "night life"), so these are for display and
-- source-scoped filtering — never for cross-source comparison. That is what
-- `topics` is for.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS tags text[];

-- True only when the source SAID it is free. Null = not stated, which is not
-- the same as paid, and the "free only" filter must treat it as excluded
-- rather than quietly promising something we don't know.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS free boolean;

-- 'public' | 'private' | 'unknown' — whether the source declares it open.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS access text;

-- ── labelled once, at ingest ─────────────────────────────────────────────────

-- Controlled cross-source vocabulary (lib/reco/audience.ts TOPICS). This is the
-- one field that means the same thing whether it came from a library or a
-- gallery, so it is the only one worth filtering the whole city on.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS topics text[];

-- 'quiet' | 'social' | 'lively'.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS energy text;

-- One short phrase naming who it suits. Shown VERBATIM as the reason a match
-- was made — never a reason inferred from a similarity score, which is how an
-- earlier version told someone a job-hunting talk matched their interest in art.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS ideal_audience text;

-- The remaining EventAudience fields (minAge, maxAge, kidsWelcome, adultsOnly,
-- format, timeOfDay, outdoor, newcomerFriendly). Jsonb rather than eight more
-- columns because nothing queries them in SQL — they are hard filters applied
-- in the ranker once a candidate set is already in memory.
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS audience jsonb;

-- Topic filtering is an array-overlap query on every feed request.
CREATE INDEX IF NOT EXISTS vendor_events_topics_idx ON vendor_events USING GIN (topics);
