-- Per-business daily counter for "Scan menu" (app/api/ai/detect-products).
--
-- The route already metered the IMAGE GENERATIONS it produces (ai_image_credits)
-- but never the scan itself, and the two are not the same spend: every scan
-- sends a full-resolution photo to the vision model whether or not any image is
-- generated afterwards. Worse, generation failures fall back to the raw crop and
-- record nothing — so a scan that generated nothing cost money and left no trace
-- to count against, which is an unbounded loop for anyone who found it.
--
-- This meters the scan. One row per (member_id, day), reserved BEFORE the
-- billable call so a failed scan still consumes its allowance.
--
-- Limits live in app code (lib/entitlements.ts → Limits.photoScans*) so a tier can
-- be re-cut without a schema change, matching voice_call_usage.
CREATE TABLE IF NOT EXISTS photo_scan_usage (
  member_id text NOT NULL,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, day)
);

ALTER TABLE photo_scan_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY photo_scan_usage_open ON photo_scan_usage FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON photo_scan_usage TO anon, authenticated, service_role;
