-- Track where a broadcast came from: the vendor portal (manual) vs the Community
-- Connector Agent channels (sms / connector / scrape). Lets us attribute and,
-- later, rate-limit or moderate connector-ingested broadcasts separately.
ALTER TABLE broadcasts ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
