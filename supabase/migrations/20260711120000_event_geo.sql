-- Give events a real map pin. vendor_events only had free-text `location` (+
-- denormalized city/neighborhood). These coordinates default to the host
-- business's location at create time, but the organizer can drag the pin on the
-- create form to point at the actual venue (which may differ from their shop).
-- Null lat/lng = no pin (the event page falls back to the host's coordinates).
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS lng double precision;
