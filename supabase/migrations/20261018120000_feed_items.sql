-- Seeded feed content (features/community-feed-seeding.md), phase 1.
--
-- A table of its own, NEVER `posts`: a sweep or a kill switch over seeded
-- content must be structurally incapable of touching a user's post.
--
-- Two kinds of row live here:
--   account 'whatslocal' — house content shown in the feed as itself
--                          (status 'live'): event recaps, house voice.
--   account 'xeno'       — drafts for the founder to edit and post as himself
--                          (status 'draft' → 'posted' | 'skipped'). A posted
--                          draft becomes a real row in `posts`, linked by post_id;
--                          the draft itself is never rendered.
--
-- Service-role only: RLS on, no policies. Drafts are not public, and the feed
-- reads through /api/feed-items.

create table if not exists public.feed_items (
  id            uuid primary key default gen_random_uuid(),

  -- 'house' | 'event' (more layers arrive with later phases)
  layer         text not null,
  -- 'whatslocal' | 'xeno' — the visible byline / who it is for
  account       text not null,
  status        text not null default 'live'
                check (status in ('live', 'draft', 'posted', 'skipped')),

  title         text,
  body          text not null,
  image_url     text,
  link_url      text,
  link_label    text,

  -- Snapshot of the source event. vendor_events rows are PRUNED once they
  -- end (lib/sources/persist.ts pruneFinished), so a recap must carry what it
  -- needs and must not depend on the event row still existing.
  event_id      uuid,
  event_date    date,
  venue         text,

  neighborhood  text,
  lat           double precision,
  lng           double precision,

  -- A posted draft's real post.
  post_id       uuid references public.posts(id) on delete set null,

  published_at  timestamptz not null default now(),  -- may be in the future
  expires_at    timestamptz,                        -- relevance, not storage
  hidden_at     timestamptz,                        -- soft; the kill switch
  reviewed_at   timestamptz,
  reviewed_by   text,

  -- Dedupe on re-run. NOT partial — ON CONFLICT cannot use a partial index.
  source_id     text not null,
  external_uid  text not null,
  created_at    timestamptz not null default now(),
  unique (source_id, external_uid)
);

create index if not exists feed_items_live_idx
  on public.feed_items (account, status, published_at desc);

alter table public.feed_items enable row level security;

-- Tables made through the Management API get no default grants: without this
-- the service role is refused ("permission denied for table feed_items").
grant select, insert, update, delete on public.feed_items to service_role;
