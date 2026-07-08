# WhatsLocal — Launch Runbook

Ordered checklist to take the app live (web = `whatslocal.ai` on CapRover) for the
SF launch. Prod is **CapRover** (`captain.whatslocal.ai`, Hussein's account,
marketplace app). The iOS shell loads the hosted site, so **web changes ship by
deploying to CapRover** — App Store approval is NOT on the critical path.

Legend: 🟩 code done (in repo) · 🟦 your dashboard/env action · ▶️ run a command

---

## 0. The one security must-do
🟦 **Set `NEXT_PUBLIC_DEMO_MODE=0`** (or remove it) in the CapRover app env. While
`=1`, the entire `/vendor/*` portal is UNAUTHENTICATED and all writes silently
no-op. This is a build-time flag → requires a redeploy to take effect.

---

## 1. CapRover env vars (marketplace app → App Configs → Environmental Variables)
Set these, then **Save & Update** (triggers rebuild):

| Var | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `0` | close the auth hole (§0) |
| `NEXT_PUBLIC_LAUNCH_PROMO` | `1` | Member free / Pro $15 promo |
| `ADMIN_CLERK_USER_IDS` | `user_xxx[,user_yyy]` | **your prod Clerk id** — or rep-create bounces you |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ…` (service_role) | correct DB access + lets RLS hardening be safe |
| `NEXT_PUBLIC_SITE_URL` | `https://whatslocal.ai` | canonicals/sitemap |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` | **LIVE** Clerk (not pk_test) |
| `CLERK_SECRET_KEY` | `sk_live_…` | LIVE Clerk |
| `STRIPE_SECRET_KEY` | `sk_live_…` | **LIVE** Stripe (real payments) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` | LIVE Stripe |
| `STRIPE_PRICE_MEMBER` | `price_…` | live $10/mo Member price |
| `STRIPE_PRICE_PRO` | `price_…` | live **$15/mo** Pro (promo) price |
| `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` | `whsec_…` | billing webhook (separate from Connect) |
| `CONNECTOR_ADMIN_TOKEN` | (matches connector `ADMIN_TOKEN`) | member create + OTP proxy |

> **Where to get them:**
> - Prod Clerk id → Clerk Dashboard (prod instance) → Users → your account.
> - Supabase service_role → Supabase → Project Settings → API → `service_role` secret.
> - Stripe live keys → Stripe Dashboard (toggle to **live mode**) → Developers → API keys.

## 2. Clerk (production instance)
🟦 User & Authentication → Contact info → enable **Phone number** as sign-in +
sign-up identifier, turn on **SMS verification code**, "verify at sign-up". (Code
already uses Clerk prebuilt components — no code change; the toggle is enough.)

## 3. Stripe (LIVE mode)
🟦 1. Create 2 recurring **Prices**: Member **$10/mo**, Pro **$15/mo** (promo).
   Optionally a $30/mo Pro price for when the promo ends.
🟦 2. Copy the price ids → `STRIPE_PRICE_MEMBER` / `STRIPE_PRICE_PRO` (§1).
🟦 3. Developers → Webhooks → **Add endpoint** →
   `https://whatslocal.ai/api/billing/webhook` → events: `checkout.session.completed`,
   `customer.subscription.created`, `.updated`, `.deleted` → copy signing secret →
   `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` (§1).

## 4. Supabase migrations
▶️ From the repo (linked to the xeno project):
```bash
supabase db push
```
Applies (among pending): `20260706130000_subscriptions`, `20260706140000_backfill_pro_grandfather`.
🟩 **`20260708120000_harden_table_grants`** (revokes anon grants) is in the repo but
**only apply it AFTER `SUPABASE_SERVICE_ROLE_KEY` is confirmed set on prod** (else
anon-key writes break). Safe once §1 service-role is set.

## 5. Connector (community-connector-agent) — for business-ownership OTP
🟩 Twilio Verify swap done in code (`lib/twilio.js`, `lib/otp.js`, `package.json`).
▶️ In the connector repo: `npm install` (adds `twilio`), then deploy (Netlify CLI).
🟦 Set on the connector env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
   `TWILIO_VERIFY_SERVICE_SID` (create a Verify Service in Twilio → Verify → Services).
> OTP is NOT needed for tomorrow's **rep admin-create** onboarding — it's for the
> self-serve claim flow. Can trail the launch by a day.

## 6. Deploy the marketplace
▶️ `scripts/deploy-caprover.sh` (or CI/CD via GitHub webhook to CapRover). Env
changes in §1 already trigger a rebuild on Save.

## 7. Seed realistic data (so live/feed/featured aren't empty)
🟩 `scripts/seed-launch.mjs` pulls REAL members from the connector and inserts
real-looking `broadcasts` / `posts` / `featured_lists` rows (idempotent).
▶️ With prod env loaded (needs `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_API_BASE`):
```bash
node --env-file=.env.local scripts/seed-launch.mjs
```
Re-run anytime — it replaces its own seed rows.

## 8. Smoke test (do these on the live site after deploy)
- [ ] Signed-out browse shows the **440 real** businesses (no fake demo).
- [ ] Phone sign-up → receive SMS code → account created.
- [ ] `/vendor/admin` loads for **you** (your Clerk id in `ADMIN_CLERK_USER_IDS`);
      create a profile from a Google search → appears as unclaimed.
- [ ] Create a post (share) → shows in feed. Send a collab invite. Open a collab room + message.
- [ ] `/vendor/billing` shows the promo (Member free / Pro $15) → "Upgrade to Pro"
      → Stripe Checkout (LIVE) → after pay, plan flips to Pro (webhook works).
- [ ] `/live` + home featured rails show seeded broadcasts.

---

## What's DONE in code (this session)
- 🟩 Launch promo (Member free / Pro $15), one flag, tiers unchanged.
- 🟩 Twilio Verify swap for business-ownership OTP (SMS + voice fallback, no 10DLC).
- 🟩 RLS hardening migration (apply after service-role key is set).
- 🟩 Removed unconditional fake-demo fallbacks (directory/feed/live/featured).
- 🟩 Seed script for realistic DB content from real members.

## Known fast-follows (NOT launch blockers)
- Distributed rate limiting (OTP already limited connector-side + Clerk-gated).
- Petitions has no DB — currently hardcoded sample causes; build a table + seed, or hide.
- App Store / TestFlight submission (web is the launch surface).
- NFC (needs paid Apple Developer enrollment).
