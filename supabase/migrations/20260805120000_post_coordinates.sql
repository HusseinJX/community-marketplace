-- Coordinates on a post, so the community feed can rank by distance.
--
-- `posts.location` is a LABEL ("SoMa", "Mission District") and for signed-out
-- users it is the literal placeholder "Current location" — nothing you can
-- measure a distance from. The composer already resolves a real device fix
-- before writing that label; it simply discarded the numbers.
--
-- NULLABLE, and deliberately not backfilled. Geocoding an existing label would
-- return the CENTRE OF A DISTRICT and print it as "0.3 mi away" about a point
-- we invented. Every row that exists today genuinely has no coordinates, and a
-- confidently wrong distance is far worse than a missing one. Forward-only.

alter table public.posts
  add column if not exists lat double precision,
  add column if not exists lng double precision;

comment on column public.posts.lat is
  'Latitude captured at compose time, ~3dp (~110m). NULL = unplaceable; never guess it.';
comment on column public.posts.lng is
  'Longitude captured at compose time, ~3dp (~110m). NULL = unplaceable; never guess it.';
