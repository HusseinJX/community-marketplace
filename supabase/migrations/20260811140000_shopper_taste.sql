-- Semantic personalisation: event embeddings + a shopper taste profile.
--
-- This ships what the "One feed, six people" prototype proved offline. That
-- demo ran the real pipeline (scripts/try-personas.ts) against a 23MB JSON file
-- on one laptop; lib/reco/rank.ts has accepted a `profileVector` since then and
-- nothing has ever passed it one. These two columns are the missing home.

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- text-embedding-3-small. The dimension is pinned in lib/reco/embed.ts
-- (EMBED_DIMS) and the two must agree — a mismatch is rejected by Postgres at
-- insert, which is the failure mode we want (loud, immediate, at write time).
ALTER TABLE vendor_events
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

-- Records WHICH model produced the vector above.
--
-- Vectors from two different models are not comparable, and mixing them does
-- not error — it silently produces nonsense similarities that read as "the
-- recommendations went a bit odd". The offline store guarded this by discarding
-- everything on a model change; the column is how the same check survives in a
-- database nobody rebuilds from scratch.
ALTER TABLE vendor_events
  ADD COLUMN IF NOT EXISTS embed_model text;

-- Deliberately NO ivfflat/hnsw index on the embedding.
--
-- An ANN index answers "the 20 nearest events", which is the wrong question
-- here: similarity is one of six ranked signals (topics, proximity, timing,
-- energy, free), so the ranker needs a score for EVERY candidate, not a
-- pre-truncated top-K that has already thrown away the near-miss two blocks
-- away. That is a full scan by definition. At ~700 live events it costs single
-- -digit milliseconds; revisit at ~50k, when the right move is a cheap
-- pre-filter, not a top-K that quietly overrides proximity.

-- The shopper's stored taste.
--
-- Keyed by TEXT, not by a Clerk id column, because most shoppers never sign in.
-- A signed-out visitor is 'device:<uuid>' from their own browser; signing in
-- switches the key to their Clerk id. Gating this on an account would ship
-- personalisation to the minority who logged in.
CREATE TABLE IF NOT EXISTS shopper_taste (
  subject_id text PRIMARY KEY,
  -- Chip ids from lib/reco/profile.ts INTERESTS.
  interests text[] NOT NULL DEFAULT '{}',
  -- Free text in the person's own words. The strongest signal, and the reason
  -- this is stored as prose rather than as a tidy set of enum columns: "I have
  -- a 4-year-old and no car" says more than any taxonomy we could design.
  about text,
  embedding extensions.vector(1536),
  -- Exactly what `embedding` was built from. Comparing against it means saving
  -- an unchanged profile costs nothing, which keeps this on the same rule as
  -- the rest of the pipeline: the model runs once per new item, never per save
  -- and never per request.
  embedded_text text,
  embed_model text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE shopper_taste ENABLE ROW LEVEL SECURITY;
-- Written and read only by server routes holding the service-role key. No anon
-- grant: a client that could write any subject_id could overwrite a stranger's
-- profile, and one that could read them could enumerate what people told us
-- about their children and their money.
GRANT ALL ON shopper_taste TO service_role;

-- Similarity for every candidate event, computed in Postgres.
--
-- The alternative — select the embeddings and cosine them in Node, as the
-- offline prototype did — means shipping 1200 x 1536 floats per request, about
-- 20MB of JSON, to answer with 1200 numbers. So the vectors stay in the
-- database and only the scores travel.
--
-- The date window mirrors the feed query exactly (end_date wins where present,
-- otherwise event_date); keep the two in step or the ranker will be handed
-- scores for events the feed never asked about, which is harmless but wasteful.
CREATE OR REPLACE FUNCTION public.event_similarity(
  q extensions.vector(1536),
  from_date text,
  max_rows int DEFAULT 1200
)
RETURNS TABLE (id uuid, sim real)
LANGUAGE sql
STABLE
-- The <=> operator lives in `extensions`; without this the function resolves
-- against the caller's search_path and fails with "operator does not exist".
SET search_path = public, extensions
AS $$
  SELECT e.id, (1 - (e.embedding <=> q))::real
  FROM vendor_events e
  WHERE e.active
    AND e.embedding IS NOT NULL
    AND (e.end_date >= from_date OR (e.end_date IS NULL AND e.event_date >= from_date))
  LIMIT max_rows;
$$;

GRANT EXECUTE ON FUNCTION public.event_similarity(extensions.vector, text, int)
  TO anon, authenticated, service_role;
