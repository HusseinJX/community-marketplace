-- A pickup address Google could actually find.
--
-- `isCollectable()` in lib/fulfillment.ts guesses: a street number, or a named
-- place with a locality after it. It exists because the address fallback reads
-- the business profile, and for a member with no street address that yields
-- their CITY — "San Francisco, CA" was being offered as a place to collect
-- from. A guess is better than nothing, and worse than asking.
--
-- So the address is now checked ONCE, when the vendor saves it, against the
-- same Google Places the onboarding search already uses. Not per checkout:
-- Google bills per request, an address changes maybe once a year, and a lookup
-- per shopper would be a bill that grows with traffic for an answer that never
-- changes (see the spending rules at the top of lib/places.ts).
--
-- What is stored is the verdict and the coordinates that came free with it —
-- which the map and the directions button can use, so this pays for itself
-- twice.
alter table vendor_settings
  add column if not exists pickup_verified boolean not null default false,
  add column if not exists pickup_lat double precision,
  add column if not exists pickup_lng double precision,
  add column if not exists pickup_formatted text;

comment on column vendor_settings.pickup_verified is
  'Google found this exact address when the vendor saved it. Checked on write, never per checkout.';
