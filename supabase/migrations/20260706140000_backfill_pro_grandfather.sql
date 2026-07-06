-- Rollout grandfather: every business that already CLAIMED a profile
-- (vendor_profiles links a Clerk user → member_id) gets a Pro subscription so
-- capability gating (commerce, voice, organize, etc.) doesn't suddenly lock them
-- out. These rows have no Stripe subscription — they're a manual grant. New
-- signups start free and must subscribe. Adjust/downgrade later as needed.
INSERT INTO subscriptions (member_id, plan, status, updated_at)
SELECT DISTINCT member_id, 'pro', 'active', now()
FROM vendor_profiles
WHERE member_id IS NOT NULL
ON CONFLICT (member_id) DO NOTHING;

-- Grandfathered Pro members also get the premium AI-image quota.
INSERT INTO ai_image_credits (member_id, premium, updated_at)
SELECT DISTINCT member_id, true, now()
FROM vendor_profiles
WHERE member_id IS NOT NULL
ON CONFLICT (member_id) DO UPDATE SET premium = true, updated_at = now();
