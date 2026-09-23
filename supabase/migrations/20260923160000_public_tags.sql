-- Tags: where a business is, and what it was part of.
--
-- `member_tags` already existed as an organizer's PRIVATE grouping — a slug and
-- a label on a join row, scoped to whoever typed it. That is the right shape
-- for "the twenty people I met at a market", and the wrong shape for "show
-- everyone at Outside Lands 2026", which is a page a shopper opens.
--
-- ── Why a tag becomes a ROW ────────────────────────────────────────────────
-- A slug on a join can't answer the questions that make tags worth having:
-- where is this market, when was this festival, is this the 2026 edition of
-- something older. So `tags` is its own table and `member_tags` points at it.
-- A vendor who trades at three markets has three edges, which was never a
-- modelling problem once tags stopped being strings.
--
-- ── Where time lives ───────────────────────────────────────────────────────
-- The one rule this whole design rests on:
--
--   Bounded THING  → dates on the tag.  "Outside Lands 2026" is one week, and
--                    everyone tagged into it inherits that.
--   Bounded EDGE   → dates/recurrence on member_tags. Ferry Plaza is permanent;
--                    this vendor is only there on Saturdays.
--   Neither        → no dates. A business inside Oracle Park is simply there.
--
-- Trying to encode "how permanent is it" into the tag's NAME is what makes this
-- feel ambiguous. It isn't one axis, it's two, and they're independent.
--
-- ── kind, and the multi-location trick ─────────────────────────────────────
-- A business with several locations is several member profiles — a customer
-- wants the branch on 24th St, with its own address, hours and posts. The
-- profiles are linked by giving each one a tag of kind 'brand'. The brand's tag
-- page IS the list of locations; no second mechanism, no parent column on
-- members.

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  -- venue     — a place you can stand in (Oracle Park, Delhi Square)
  -- market    — a recurring trading spot (Ferry Plaza Farmers Market)
  -- district  — a neighbourhood or strip
  -- festival  — a bounded happening (Outside Lands 2026)
  -- brand     — the thing several locations have in common
  kind text NOT NULL DEFAULT 'venue',
  description text,
  lat double precision,
  lng double precision,
  -- Set ONLY when the thing itself is bounded. A festival edition has these;
  -- a market does not.
  starts_at timestamptz,
  ends_at timestamptz,
  -- "Outside Lands 2026" → "Outside Lands", so you can ask who has EVER done
  -- it as well as who did it this year.
  parent_id uuid REFERENCES tags(id) ON DELETE SET NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tags_kind_idx ON tags (kind, label);
CREATE INDEX IF NOT EXISTS tags_parent_idx ON tags (parent_id);

-- The edge gains an identity and its own optional time.
ALTER TABLE member_tags ADD COLUMN IF NOT EXISTS tag_id uuid REFERENCES tags(id) ON DELETE CASCADE;
ALTER TABLE member_tags ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE member_tags ADD COLUMN IF NOT EXISTS ends_at timestamptz;
-- Free text on purpose ("Saturdays", "first Sunday"). A structured recurrence
-- is a calendar subsystem, and nobody has asked this to compute anything yet.
ALTER TABLE member_tags ADD COLUMN IF NOT EXISTS recurrence text;
-- vendor | performer | resident | artist — what they do there.
ALTER TABLE member_tags ADD COLUMN IF NOT EXISTS role text;

-- owner_id was NOT NULL because every tag belonged to the organizer who typed
-- it. A public tag belongs to nobody, so it has to be droppable — the existing
-- private rows keep theirs and keep working.
ALTER TABLE member_tags ALTER COLUMN owner_id DROP NOT NULL;

-- One edge per (member, tag) — what makes re-tagging while canvassing
-- idempotent. The old uniqueness on (owner_id, member_id, tag_slug) stays for
-- the private rows.
--
-- NOT partial. A partial unique index cannot back ON CONFLICT unless the
-- statement repeats the predicate, which PostgREST's upsert does not do — the
-- first version of this was `WHERE tag_id IS NOT NULL` and every tag write
-- failed with "no unique or exclusion constraint matching the ON CONFLICT
-- specification". Plain is also correct: Postgres treats NULLs as distinct, so
-- legacy rows with a null tag_id still never collide.
CREATE UNIQUE INDEX IF NOT EXISTS member_tags_member_tag_idx
  ON member_tags (member_id, tag_id);

-- "Everyone in this tag" — the page this whole migration exists to serve.
CREATE INDEX IF NOT EXISTS member_tags_tag_idx ON member_tags (tag_id, created_at DESC);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
GRANT ALL ON tags TO service_role;
