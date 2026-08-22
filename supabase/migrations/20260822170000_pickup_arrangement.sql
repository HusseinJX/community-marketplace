-- Where to collect, when there is no address to collect from.
--
-- Pickup used to be offered to every buyer of a physical item, and when the
-- vendor had no address on file the checkout said "the vendor will contact you
-- about collecting your order" — a promise made on the vendor's behalf, to
-- someone who had already paid, about an arrangement nobody had made.
--
-- That was survivable while every vendor came from a Google listing with a
-- street address. It stopped being survivable on 2026-08-22, when a business
-- could onboard with no fixed address at all.
--
-- So: pickup is offered only when the vendor has said where. Either an address
-- (uber_pickup_address, or the address on their listing) or this — a free-text
-- arrangement for the ones who have no door: "Outside the Ferry Building,
-- Saturdays 9-1", "Message me and I'll meet you".
alter table vendor_settings
  add column if not exists pickup_note text;

comment on column vendor_settings.pickup_note is
  'Free-text collection arrangement for vendors with no fixed address. Either this or an address must be set before pickup is offered at checkout.';
