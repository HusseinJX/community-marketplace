-- Denormalize the host's city + neighborhood onto each event so events can be
-- scoped to a place (the "neighborhood lens"). vendor_events only had a
-- free-text `location`; these structured fields drive place filtering on the
-- home feed and "near you" discovery. Populated at create time from the host's
-- profile (best-effort); existing rows stay null and fall into "all areas".
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE vendor_events ADD COLUMN IF NOT EXISTS neighborhood text;
