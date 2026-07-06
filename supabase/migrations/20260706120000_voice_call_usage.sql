-- Per-business daily voice-call counter. Realtime voice is billed per minute, so
-- we cap how many browser voice calls a business's AI agent will answer per day
-- to bound cost / abuse. One row per (member_id, day); the count is bumped each
-- time a Realtime session is minted (app/api/chat/[memberId]/voice).
--
-- The per-day limit itself lives in app code (lib/voice-limits.ts) so it can be
-- driven by the business's subscription tier later without a schema change.
CREATE TABLE IF NOT EXISTS voice_call_usage (
  member_id text NOT NULL,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, day)
);

ALTER TABLE voice_call_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY voice_call_usage_open ON voice_call_usage FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON voice_call_usage TO anon, authenticated, service_role;
