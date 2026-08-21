-- Support links + free "everything else" links for a member's public page.
--
-- The 13 SOCIAL platforms we already store live on the connector's member
-- profile (instagramHandle, tiktokHandle, …) and stay there — they are part of
-- who the business is, and the profile page already renders them. These two are
-- different in kind and have no home there:
--
--   support_links — Cash App, Venmo, PayPal, Patreon, GoFundMe, Buy Me a
--     Coffee. EXTERNAL money links. They route around Stripe Connect entirely,
--     so they must never render where a purchasable item does; keeping them in
--     their own column is the first half of keeping them structurally separate
--     from Buy/Book (App Store 3.1.1 — an external link for a community cause
--     is fine, one that buys OUR subscription is not).
--
--   custom_links — title + URL, in the order the member arranged them. The
--     "everything else" row; the Linktree part.
--
-- jsonb, not two more tables: these are read and written whole, as one list per
-- member, and are never queried across members.
alter table vendor_settings
  add column if not exists support_links jsonb not null default '[]'::jsonb,
  add column if not exists custom_links  jsonb not null default '[]'::jsonb;

comment on column vendor_settings.support_links is
  'External support/tip links: [{ "id": "cashapp", "value": "$handle" }]. NOT our checkout.';
comment on column vendor_settings.custom_links is
  'Free links in display order: [{ "title": "Our menu", "url": "https://…" }].';
