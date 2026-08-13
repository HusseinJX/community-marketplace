# Environment variables (full)

## Environment Variables
**Core:**
- `NEXT_PUBLIC_SITE_URL` — canonical site origin (`https://whatslocal.ai`). Used by `metadataBase`, canonical tags, sitemap, robots, JSON-LD. **⚠️ The domain does not yet point at this app** (currently serving a different app); DNS will be repointed soon. Until then, sitemap/canonical URLs reference an origin that isn't live yet.
- `NEXT_PUBLIC_API_BASE` — Community Connector Agent base URL (e.g. `http://localhost:8888`)
- `CONNECTOR_URL` — server-side connector agent URL (same value, not public)
- `CONNECTOR_ADMIN_TOKEN` — bearer token matching `ADMIN_TOKEN` in connector-agent (for `/verify`, `/claim-profile`, `/sms-send`)

**Clerk:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — shared with zahabenergy project

**Stripe:**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`

**Supabase:**
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — xeno project

**Uber Direct:**
- `UBER_DIRECT_CUSTOMER_ID` / `UBER_DIRECT_CLIENT_ID` / `UBER_DIRECT_CLIENT_SECRET` / `UBER_DIRECT_WEBHOOK_SECRET` — **none set; delivery is off platform-wide.** Auth is OAuth client-credentials (`auth.uber.com/oauth/v2/token`, scope `eats.deliveries`, 30-day token, minted + cached in `lib/uber-direct.ts`). There is **no** long-lived "server token" — the old `UBER_DIRECT_SERVER_TOKEN` was a credential Uber doesn't issue for this API, so dispatch could never have worked. Get the client id/secret + customer id from the Uber Direct dashboard. `uberConfigured()` gates the vendor delivery toggle, so the UI stays honest until they're set.

**Composio (catalog sync + order push — native to this app):**
- `COMPOSIO_API_KEY` — **required** for catalog sync / connect / order push-back. Commerce no-ops until set.
- `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID` / `COMPOSIO_SQUARE_AUTH_CONFIG_ID` — Composio auth-config ids (one per platform, created in the Composio dashboard)
- `MARKETPLACE_URL` — base origin for the OAuth callback redirect (falls back to `NEXT_PUBLIC_SITE_URL`)

**Trigger.dev (catalog sync jobs):**
- `TRIGGER_PROJECT_REF` — this repo's Trigger.dev project ref (from `npx trigger.dev init`); read by `trigger.config.ts`
- `TRIGGER_SECRET_KEY` — server key used by `/api/vendor/composio` to dispatch the on-demand sync task. If unset, "Sync Now" runs an inline sync instead.

**AI (OpenAI):**
- `OPENAI_API_KEY` — **required** for the per-business assistant (and Phase 2 vision/image gen). Not yet in `.env.local`.
- `OPENAI_CHAT_MODEL` / `OPENAI_VISION_MODEL` / `OPENAI_IMAGE_MODEL` — optional overrides (default `gpt-4o-mini` / `gpt-4o` / `gpt-image-1`)
- `OPENAI_EMBED_MODEL` — optional override (default `text-embedding-3-small`, 1536 dims). **⚠️ Changing it invalidates every stored vector** — the dimension is pinned in the `vector(1536)` columns and vectors from two models are not comparable. `embed_model` is recorded on every row so a mismatch degrades to keyword ranking instead of producing confident nonsense; a real change means a re-embed (`scripts/embed-stored-events.ts`) plus a migration for the new dimension.
- `SUPABASE_SERVICE_ROLE_KEY` — preferred for Supabase Storage writes; falls back to anon key
- `SUPABASE_MEDIA_BUCKET` — storage bucket name (default `marketplace-media`)
- `ADMIN_CLERK_USER_IDS` — comma-separated Clerk user IDs allowed to manage any business's catalog/events on their behalf
- `NEXT_PUBLIC_DEMO_MODE` — `1` opens the vendor portal without auth for demo/testing (see Demo Mode). **`0` on live CapRover prod as of 2026-07-08 (launched) — keep it off.**
- `JOINDEMO_PASSWORD` — shared **demo password** gating BOTH `/joindemo` (billable Places/voice) and the **admin portal preview** (`/demo` → `/vendor`). Fail-closed in prod: with no value the demos are locked (no guessable default). **SET on CapRover prod = `WhatsLocalDemo2026!`** (change in the CapRover dashboard). Not needed locally (dev falls back to a default).

**Platform subscriptions (Stripe, LIVE):**
- `STRIPE_PRICE_MEMBER` / `STRIPE_PRICE_PRO` — live recurring Price ids ($10/mo, $30/mo).
- `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET` — signing secret for `/api/billing/webhook` (SEPARATE from the Connect `STRIPE_WEBHOOK_SECRET`). Events: `checkout.session.completed` + `customer.subscription.*`.
- `SUPABASE_SERVICE_ROLE_KEY` — **now set on prod** (2026-07-08); the app writes via service-role (bypasses RLS). Required after the RLS-hardening migration (`20260708120000`) revoked anon grants on `subscriptions`/`collab_*`/`posts`.

**Apple IAP (iOS subscriptions — LIVE):**
- `APPLE_APP_APPLE_ID` — the numeric App Store app id. **SET on CapRover prod.** Required for verifying **production** App Store Server Notifications; without it the routes fail closed (503).
- `APPLE_IAP_BUNDLE_ID` — optional, defaults to `ai.whatslocal.app`.
- Apple's 4 root CAs are **compiled into `lib/apple-root-cas.ts`**, NOT read from disk — the deploy tar ships `.next/standalone` + `.next/static` + `public` only, so a `certs/` directory would never reach the container. `certs/apple/*.pem` is kept as the source-of-truth reference for regenerating that module; don't "fix" the routes to read from it.

**Google Places (onboarding enrichment + create UI):**
- `GOOGLE_PLACES_API_KEY` — server-side (marketplace `/api/places/*` proxy + connector `enrich.js`). Restrict to Places/Places-New/Geocoding APIs + a quota cap. Keeps off the browser (no `NEXT_PUBLIC`).

**Perplexity (enrichment "story" — connector):**
- `PERPLEXITY_API_KEY` — `sonar` web-search for the business story/vibe in `enrich.js`.

**YouTube (video storage — `lib/youtube.ts`): ✅ WORKING + DEPLOYED (2026-08-04).** Uploaded videos go to the **`WhatsLocal AI` Brand Account channel** (`UC9QE0QLOPBMVMk_SI59h0eg`) as **unlisted** (not Supabase Storage) and are embedded via `lib/embed.ts` (`streamEmbed`/`youtubeThumb`). Both `/api/share/upload` and `/api/upload` route `video/*` → `uploadVideo`; the watch URL is stored in `posts.video_urls`. **YouTube-only, no Supabase fallback** — 503 until configured (`youtubeConfigured()`). Images unchanged. `YOUTUBE_*` are set on CapRover prod and the container has been redeployed since. **⚠️ CapRover's env API REPLACES the whole set** — read the app definition, extend it, write it back; never post a partial one.
  - **UNLISTED, never private.** Private videos **cannot be embedded at all** — the privacy check runs on the *viewer*, so every visitor sees "This video is private" (verified by uploading the same clip both ways). Unlisted = out of search/browse/recommendations, playable by link. Corollary: **the link IS the access control** — treat `posts.video_urls` as public-but-unindexed.
  - **The channel is chosen at CONSENT, not by the Cloud project.** The OAuth client only identifies the app and can live in any project; the refresh token binds to whichever channel is picked on the Google screen, and nothing in the token says which. So `uploadVideo` returns `channelId`/`channelTitle` per upload — that is the only way to confirm videos aren't going to someone's personal channel. If uploads land in the wrong place, re-consent and pick the Brand Account; don't recreate credentials.
  - **Deleting** (`deleteVideo`, `deleteVideosSafe`, `DELETE /api/posts/[id]`) needs the **`youtube.force-ssl`** scope — `youtube.upload` can only ever ADD. `scripts/youtube-refresh-token.mjs` requests both; a token minted before that will 403 on delete while uploads keep working.
  - **Three deletion paths, and the difference matters.** `removePost()` = soft hide, undone by `restorePost()`, **leaves the video up** (reaping it would make restore impossible). `deleteOwnPost()` = the author (or an admin) deleting for good, **reaps**. `purgePost()` (`action:'purge'` on `/api/admin/moderation`) = a moderator takedown that means it, **reaps**. Use `remove` when acting on a report you might be wrong about; `purge` when the content genuinely has to leave the channel. **A YouTube delete is not instantly visible** — oembed still returned 200 right after a successful delete and 404 ten seconds later, so don't read an immediate 200 as failure.
  - **`extractVideoId` must check the host first.** A YouTube id is any 11 chars of `[A-Za-z0-9_-]`, which plenty of ordinary path segments match (`https://example.com/not-a-video` → `not-a-video`). Host-checking also makes legacy Supabase video URLs correctly return null.
  - **Setup, if it ever needs redoing:** Google Cloud project → enable **YouTube Data API v3 on the project that owns the OAuth client** (the error names the project *number*, which may not be the one you think) → **Desktop-app** OAuth client (allows the loopback redirect) → consent screen **In production**, not Testing (**Testing refresh tokens expire after 7 days**) → `YOUTUBE_CLIENT_ID=… YOUTUBE_CLIENT_SECRET=… node scripts/youtube-refresh-token.mjs`, approving as the account that *manages* the Brand Account and picking that channel.
- `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` — OAuth client (falls back to `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`). **SET locally 2026-08-04.**
- `YOUTUBE_REFRESH_TOKEN` — long-lived refresh token, bound to the `WhatsLocal AI` Brand Account, scopes `youtube.upload` + `youtube.force-ssl` (the second is what allows delete). **Secret — never commit.** **SET locally AND on CapRover prod (2026-08-04).** *Caveat: an authenticated upload on prod has not been exercised — `/api/share/upload` checks auth before `youtubeConfigured()`, so the 503→working transition is not observable from outside. Confirm by posting a video on whatslocal.ai and checking a `youtube.com` URL landed in `posts.video_urls`.*

**Twilio Verify (business-ownership OTP — connector):**
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_VERIFY_SERVICE_SID` — Twilio Verify (SMS + voice fallback; bypasses 10DLC). Telnyx stays for other SMS.

**Trigger.dev cron flags (connector):**
- `HARVEST_OAKLAND_ENABLED` / `HARVEST_EVENTS_ENABLED` / `FOLLOWUP_INTROS_ENABLED` — set `=1` to re-enable a disabled cron (all off as of 2026-07-08 except `prune-collab-pool`).

**Email (Resend) — organizer event update blasts:**
- `RESEND_API_KEY` — Resend API key. Email blasts no-op until set (SMS still works).
- `RESEND_FROM` — verified sender, e.g. `WhatsLocal AI <events@whatslocal.ai>`. Required alongside the key.

**SMS (organizer blasts + Uber notifications):** reuses `CONNECTOR_URL` + `CONNECTOR_ADMIN_TOKEN` (proxied to the connector-agent `sms-send` Twilio function). `lib/sms.ts` no-ops if unset.

**Push notifications (native APNs — no third party):**
- `APNS_KEY_ID` — the APNs Auth Key ID (from the `.p8` filename `AuthKey_<KEYID>.p8`).
- `APNS_TEAM_ID` — Apple Developer Team ID (`6UWM5JUAC5`).
- `APNS_BUNDLE_ID` — app bundle id / APNs topic (`ai.whatslocal.app`).
- `APNS_ENV` — `sandbox` for Xcode dev/TestFlight-debug builds, `production` for App Store/TestFlight release builds (picks the APNs host + must match the build's `aps-environment`).
- `APNS_KEY` — the **contents** of the `.p8` (PEM). Store single-line with `\n` escapes; `lib/push.ts` un-escapes. **Secret — never commit** (the `.p8` lives at `~/Desktop/dev/AuthKey_*.p8`, outside any repo). Sending no-ops until all four (`KEY_ID`/`TEAM_ID`/`KEY` + optional bundle/env) are set.

**Error tracking (Sentry) — LIVE on prod since 2026-08-10; no-ops entirely until the DSN is set:**
- `NEXT_PUBLIC_SENTRY_DSN` — client DSN. **BAKED AT BUILD TIME, and this repo BUILDS LOCALLY** (`npm run build` → tar → POST to CapRover), so the value that ships comes from **`.env.local` on the build machine**, NOT from CapRover. Setting it on CapRover does nothing for the browser bundle — it is set there only because the server config falls back to it. Verified 2026-08-10: the DSN string is present in `.next/static/chunks/`.
- `SENTRY_DSN` — server + edge, read from the CONTAINER env at runtime (the deploy tar carries no `.env` files), so this one genuinely must live on CapRover. **SET on CapRover prod 2026-08-10** (52 env vars now; the update API replaces the whole set, so it was read-extend-write and all 49 originals were re-verified afterwards). Also **SET on Trigger.dev's `prod` environment** for the worker — separate API, separate key: fetch the prod key with the CLI PAT (`GET /api/v1/projects/<ref>/prod`), then `POST /api/v1/projects/<ref>/envvars/prod`.
- `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` — build-time source-map upload, so a prod stack trace names our functions instead of minified letters. Absent = upload skipped, build still succeeds. **Both slugs are `whatslocal`** (org and project share the name). The token is an **org auth token** (`sntrys_…`), which embeds its own `org` and `region_url` — so `sentry.io/api/0/...` **403s** and calls must go to `us.sentry.io`, and a 403 there means a missing SCOPE, not a bad token: an upload token carries `project:releases`, NOT `project:read`, so it cannot LIST projects. `scripts/sentry-fill-slugs.mjs` handles both (decodes the token for the org, probes `…/releases/` per candidate slug for the project). **Verified 2026-08-10:** 1,742 files uploaded as an artifact bundle with debug IDs, and `.next/static` contains **0** `.map` files afterwards (`deleteSourcemapsAfterUpload`), so nothing is served publicly — the 197 that remain are under `.next/standalone/.next/server/`, which Next never serves.
- `SENTRY_VERBOSE=1` — makes the build print what it did with the source maps. The upload is silent by default, which means **a build that skipped it looks identical to one that did it**; set this whenever you need to confirm.
- `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` — default `0.1`. Tracing is metered and PostHog already covers product timing; this is an error reporter.

**Observability & analytics:**
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` — same PostHog project as connector-agent so visitor + onboarding events stitch into one funnel. **PostHog is the single product-analytics tool (no Mixpanel — it does unique users/funnels/retention PLUS session replay + flags).** `person_profiles:"always"` makes anonymous visitors into people; autocapture ON (clicks), `capture_pageleave` ON (drop-off), GeoIP auto-captured (country/city/`$ip`). Unique users = cookie `distinct_id` (persists ~1yr across reloads/days on a device); cross-device unifies on Clerk login (`IdentityBridge` in `lib/posthog-provider.tsx`). **NOTE: identity is cookie/login-based, never IP** — IP is a captured property only (shared/dynamic IPs make it useless as an identity key). posthog-js ingests via a **reverse proxy** (`api_host:"/ingest"` + `next.config.ts` rewrites → `us(-assets).i.posthog.com`, `skipTrailingSlashRedirect`) so ad blockers don't drop it. **Session replay is ON** — verified 2026-08-10 against PostHog's public remote config (`GET https://us.i.posthog.com/array/$NEXT_PUBLIC_POSTHOG_KEY/config` → `sessionRecording` is an object; a disabled project returns `sessionRecording: false`). This file previously said the switch was off, which was wrong and was repeated in a session before anyone checked — the `POSTHOG_PERSONAL_API_KEY` is scoped to event-send only, so `/api/projects/…` 403s `permission_denied` and the remote-config URL above is the way to check without any key at all. **Recording is 100% of sessions** (`sampleRate: null`, `minimumDurationMilliseconds: null`, `urlBlocklist: []`, `consoleLogRecordingEnabled: true`) — set a sample rate and a minimum duration in the dashboard before volume grows. **Masking is a CODE concern, not a dashboard one:** `maskAllInputs` covers only what is being typed, so every surface rendering what a person SAID carries `data-private` (the `maskTextSelector`) — customer inbox incl. list previews, assistant chats, community rooms, collab/event threads, onboarding + join interviews. **A new conversation surface must be marked or it is recorded verbatim.**
- `POSTHOG_PROJECT_ID` / `POSTHOG_PERSONAL_API_KEY` — server-side PostHog API access (querying event data; the personal key is send/mgmt-scoped).
- **Ad/retargeting pixels (env-gated, no-op until set):** `NEXT_PUBLIC_META_PIXEL_ID` (Facebook/Instagram), `NEXT_PUBLIC_GA4_ID` (`G-…`), `NEXT_PUBLIC_GOOGLE_ADS_ID` (`AW-…`, for Google + YouTube ads). Loaded by `components/analytics/AdPixels.tsx` and **gated on cookie consent** (`lib/consent.ts` + `components/analytics/ConsentBanner.tsx`, `wl_consent` localStorage): Google uses **Consent Mode v2** (tag loads with all denied by default → granted on Accept); Meta loads only after Accept. PostHog runs regardless (first-party). **Unified conversion helper `lib/analytics.ts` `trackConversion(event, params, {meta})`** fans one call out to PostHog + Meta + Google — use it at real conversion moments (signup, claim, subscribe, checkout, RSVP); `lib/track.ts` remains the collaboration-funnel-specific tracker.
