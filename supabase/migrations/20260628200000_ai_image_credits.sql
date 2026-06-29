-- Per-member quota + rate limit for AI product-image generation (gpt-image-1).
-- AI image generation is a premium feature: each business gets a small number of
-- free generations, after which they must upgrade. We also keep a rolling hourly
-- window to cap cost / abuse even for premium members.
--   generated_count : lifetime images generated (drives the free allowance)
--   premium         : has an active paid subscription (unlocks past the free cap)
--   window_start    : start of the current rolling rate-limit window
--   window_count    : generations within the current window
CREATE TABLE IF NOT EXISTS ai_image_credits (
  member_id text PRIMARY KEY,
  generated_count integer NOT NULL DEFAULT 0,
  premium boolean NOT NULL DEFAULT false,
  window_start timestamptz,
  window_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_image_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_image_credits_open ON ai_image_credits FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON ai_image_credits TO anon, authenticated, service_role;
