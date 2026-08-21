-- Shop + contact links that have no home on the connector member profile.
--
-- The profile already carries a handful (shopifyUrl, etsyUrl, shopUrl,
-- businessPhone) and those keep using it — they are part of the business
-- record and other surfaces read them. What lands here is everything else a
-- business is legitimately already selling or answering through: a Toast
-- ordering page, a DoorDash listing, their own iPhone app, an email address.
--
-- Kept SEPARATE from support_links even though both are "links in jsonb".
-- Support links are external money and carry a rule about where they may be
-- rendered (App Store 3.1.1); these are ordinary outbound links. One column
-- for both would make that distinction a matter of remembering, and the whole
-- point is that it should be structural.
alter table vendor_settings
  add column if not exists other_links jsonb not null default '[]'::jsonb;

comment on column vendor_settings.other_links is
  'Shop + contact links with no profile field: [{ "id": "toast", "value": "https://…" }]. See lib/links.ts.';
