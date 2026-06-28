-- Vibe media on a broadcast: photos of the crowd/screens/atmosphere and an
-- optional livestream link, so shoppers get a "live view" before they go.
-- (Scheduling-ahead needs no new column — a future starts_at is already a
-- scheduled broadcast; getLiveBroadcasts only surfaces it once starts_at <= now.)
ALTER TABLE broadcasts ADD COLUMN image_urls TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE broadcasts ADD COLUMN livestream_url TEXT;
