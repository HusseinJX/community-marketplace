# Tasks

## ⚠️ START HERE — two tracks queued (2026-08-04 handoff)
Handoff: `session-context/2026-08-04-handoff.md`. Everything through `d6ce033` is
**pushed AND deployed** — prod == git.

### Track 1 — proximity ranking ✅ DONE + DEPLOYED + PUSHED 2026-08-05
Spec: `session-context/2026-08-05-proximity-ranking-spec.md`. Both halves shipped in code.
- [x] **Businesses rank nearest-first on the Shop tab** (`LocalDirectory` + `lib/proximity.ts` + a distance chip on `MemberCard`). No migration. "Near me" = hide past this radius, nothing else; members with no coords are excluded from it and counted out loud, and never show a distance.
- [x] **Posts capture coordinates going forward** — migration `20260805120000_post_coordinates` **applied to prod and registered**; `ShareComposer` keeps the fix it already resolved; `CommunityFeed` ranks placed posts nearest-first with recency as tiebreak and fallback. Old posts stay unplaceable, sort behind, show no distance. Geocoding labels stays rejected.
- [x] **One geolocation prompt on home** — `LiveFeed`/`LiveNowRail` moved off direct `getUserPosition()`; `useViewerPosition` borrows an existing home fix.
- [x] **"Nearby businesses" rail on the event page** (`components/events/NearbyBusinesses.tsx`) — nearest 12 within 5mi of the **venue**, server-rendered (no permission dialog), self-hiding. Also fixed a pre-existing infinite render loop found while verifying it (`data ?? []` in `lib/data-hooks.ts` → `MemoriesGrid`).
- [x] **Deployed** — CapRover **v96**, verified on prod (city header, sticky day heading, single distance badge, nearby rail). Pushed: `feat/collab-rooms` `4e3a965 → 24c4789`. Migration `20260805120000` applied + registered. **Prod == git == DB.**
- [ ] **Open:** no business surface other than the Shop tab ranks yet — `/explore` and `/browse` still sort by name-match score. `lib/proximity.ts` is ready for both.

### Track 2 — native ✅ 2026-08-05
- [x] **NFC fob → app deep link — DONE + LIVE, and it was WEB-ONLY.** The old note here was wrong: `com.apple.developer.associated-domains` was **already in the shipped App Store build** (verified with `codesign -d --entitlements` against the submitted 2026-07-29 archive), the AASA was already served as `application/json` with no redirect, and `lib/native-links.ts` already routed same-origin paths. The only gap was the AASA **path list**, which claimed only auth callbacks — so `/members/{id}` (what a fob encodes) went to Safari. Added `/members/*` `/events/*` `/live/*` `/featured/*`; `/checkout` deliberately left unclaimed. Deployed, Apple's CDN picked it up, **a real fob tap opened the app** (needed one delete+reinstall to refresh the device's cached copy).
- [x] **Swipe-to-go-back + white splash — built, verified, submitted as 1.0.1 (5).** Swipe = `MainViewController.swift` (`allowsBackForwardNavigationGestures`); the shipped nib named `CAPBridgeViewController`, the new one names `_TtC3App18MainViewController`. Splash = the dark variant was **navy with a white tile**, blown up by `scaleAspectFill` to ~75% of screen width; now a white view (explicit white — `systemBackgroundColor` is BLACK in dark mode) with the logo constrained to 160pt. Both confirmed by eye in the Simulator on the Release build before submitting. Backups: `whatslocal-ios/.backup-splash-20260805/`.
- [ ] **Still staged, not done:** the NFC tag-reading entitlement is **not linked in the pbxproj** (needs the Xcode capability toggle + a physical device); **ATT must be wired before the ad pixels are ever switched on**. (Push `presentationOptions` is already synced into `ios/App/App/capacitor.config.json` — no action left.)

### Accepted as-is — do NOT "fix" these unprompted (confirmed 2026-08-04)
- **Book button is a UI-only demo** — there is no booking/reservations system behind it.
- **iOS share-sheet** — not needed right now.
- **Orphan routes** (`/vendor/messages/assistant`, `/messages/assistant`, `/events`, unlinked shopper routes) — reachable by URL, linked from nothing. Fine.

### Five temporary hides — one-entry reverts, no decision yet
Render branches intact in every case.
- [ ] **The whole Collabs section** on the vendor dashboard (`VendorHome.tsx` → `SHOW_COLLABS = false`; flip to `true`)
- [ ] Collabs **Create** tab (`VendorHome.tsx`, `tabs` array)
- [ ] **Start selling** checklist (`app/vendor/page.tsx:169`, commented)
- [ ] **Opportunities near you** = Collabs *Join* tab (`VendorHome.tsx`)
- [ ] **Paste an event link** (`VendorHome.tsx`, commented block)

## 2026-08-04 Event sweep fix, draft queue, feed rework, video upload (see `session-context/2026-08-04-youtube-video-delete-purge.md` + `2026-08-02-event-sourcing-geo-reco.md`)
**All DEPLOYED to CapRover prod and pushed** (`d9feaf2` → `43b5129` on `feat/collab-rooms`).

**Unproven — the only assumed link:**
- [ ] **An authenticated video upload on PROD has never run.** `/api/share/upload` checks `auth()` before `youtubeConfigured()`, so an unauthenticated probe is 401 either way and the 503→working flip can't be seen from outside. Everything upstream is verified against the live YouTube API + prod DB with the same credentials and code path. **Close it:** post a video on whatslocal.ai → confirm a `youtube.com` URL in `posts.video_urls` on channel `UC9QE0QLOPBMVMk_SI59h0eg`.
- [ ] **The scraped-drafts UI has never been seen RENDERED.** Live on prod, admin-gated; data/API/auth all verified, layout is not (`isAdmin` redirects a headless session). Open `/vendor/admin?tab=drafts` signed in.
- [ ] **No 09:00 UTC scheduled sweep has been observed yet.** Two faults that would have killed it silently are fixed and manual prod runs of the same task on the same deployment succeed; the first real cron is 2026-08-05 09:00 UTC. Check it fired.

**Video / moderation gaps (known, deliberate):**
- [ ] **`banAuthor()` only soft-removes** a banned user's posts, so their videos stay live on the channel by link. `purge` is per-post only — a banned author needs a bulk purge.
- [ ] **There is no moderation UI at all** — the queue is API-only (`/api/admin/moderation`), so `remove`/`restore`/`ban`/`purge` are curl-only. App Store 1.2 expects reports actioned within 24h; that's hard without a screen.
- [ ] **Every user's video lands on ONE company channel** (`WhatsLocal AI`). That's the design (free storage/transcoding), but the brand channel accumulates strangers' uploads and inherits YouTube's copyright/strike exposure as volume grows.
- [ ] **A moderator-removed post keeps its video** (correct — `remove` is restorable). Use `purge` when it must actually leave the channel; make sure whoever moderates knows the difference.

**Feed / events follow-ups:**
- [ ] **The For-you feed caps at 240** returned events (60 revealed at a time). Past that it says "add a filter" rather than paging further — revisit only if people hit it.
- [ ] **The 41 `downtownsf` drafts are still unreviewed** — the queue exists now, nobody has used it.
- [ ] Signed-out users still see "Current location", not a neighbourhood (`/api/places/reverse` is auth-gated because each call is billed). Cost decision, not a code one.
- [ ] `/events` still exists with its own For-you toggle and nothing links to it. Decide whether that page should exist.
- [ ] **NFC fob → native app deep link: NOT STARTED.** Needs Universal Links — the AASA file (web, deployable) AND `com.apple.developer.associated-domains` in `App.entitlements` (**Xcode rebuild + App Review**). Neither half works alone, and users on the current build keep getting Safari until they update.


## 2026-07-11 Collab pivot + Firestore quota (see `session-context/2026-07-11-collab-pivot-and-firestore-quota.md`)
Everything from that session is **built but LOCAL/uncommitted in both repos** — prod is unchanged.

**Blocking, in order:**
- [ ] **⚠️ Firestore quota is REALLY exhausted** — `8 RESOURCE_EXHAUSTED` on a 2-doc read of project `whatlocal-ab06e` (Spark, 50k reads/day), reproduced from local with the same creds. **This supersedes the 2026-07-08 "false alarm" note below** — that was a different symptom (reserved `__…__` doc ids); this one is real. Every semantic surface (matcher, opportunities, search) is dark until it resets (midnight PT). Metrics can't be queried on Spark (the Monitoring API itself 403s: "requires billing") — only the Firebase console → Firestore → **Usage** tab shows them. `roles/monitoring.viewer` is already granted to the service account, so the API works the moment billing is on.
- [ ] **Deploy BOTH repos together** — none of the read-cost fixes are live. marketplace → CapRover; connector → Netlify (⚠️ that repo has unrelated uncommitted WIP — only 6 files are ours: `lib/db.js`, `matches.js`, `admin.js`, `lib/search.js`, `lib/collabs.js`, `lib/collabActivity.js`).
- [ ] **Verify the connector member cache** (`loadMember` 2nd read ≈0ms, `invalidateMember` → refetch). Couldn't run it: even the first read 500s right now.
- [ ] **Then** decide on Blaze from a clean baseline (reads should cost cents once the pathological calls are gone).

**Test the thesis (can't be read without these):**
- [ ] **Fire the funnel once and confirm it lands in PostHog.** `lib/track.ts`: `matches_shown → collab_invite_sent → collab_invite_accepted → collab_agreed → collab_event_created`, plus `opportunity_ask_to_join`. The number the whole bet turns on is **`collab_started` with `collaborations_before >= 1`** = someone started a SECOND collaboration unprompted. Never observed firing yet.
- [ ] **Feed outcomes back to the connector** (`matchLogs` / `marketplace-outcome`) — see `features/collaboration-matching.md`. Marketplace-side events exist now; the learning loop is still open.
- [ ] Get ~10 event-native businesses in ONE district and help one real event happen.

**UI / product follow-ups:**
- [ ] **The business door isn't on the front door.** `/businesses` (public matcher demo, no login) + `/organizers` (public organizer toolkit on sample data) exist, but are only linked from the FOOTER — a cold visitor to `/` still meets the shopper feed. Decide whether supply gets an above-the-fold entry on `/`.
- [ ] **Collab → Organize seam is silent.** When a collaboration becomes an event, nothing points at the lineup tooling. Add "Manage the lineup →" in the thread once `eventId` exists, and gate `/vendor/organize` visibility on `isEventOrganizer()` (`lib/org-focus.ts`) so a solo baker isn't shown festival tooling.
- [ ] **Orphan shopper routes** — `/live`, `/explore`, `/sf`, `/watch-world-cup`, `/resources`, `/petitions` are unlinked from primary nav but still exist; some duplicate the home tabs. Keep or delete.
- [ ] **Opportunities is 3 connector calls** per dashboard load; could be 1 (ask "who complements me?" once, match against events locally).
- [ ] Hosts still can't **post an open role** ("need a food partner, Aug 15") — needs a table (`collab_invites.to_id` is NOT NULL, so it can't be faked).
- [ ] **Pricing re-cut** (free participate / $10 act / $30 capture) — untouched; invites are still Pro.
- [ ] `unstable_cache` is superseded by `'use cache'` in Next 16 (works here because `cacheComponents` is off) — app-wide migration someday.

## 2026-07-08 SF launch — carry-forward (see `session-context/2026-07-08-sf-launch.md`)
The app is **LIVE** on prod (`whatslocal.ai` / CapRover). Remaining:
- ✅ **`/join` in-app onboarding interview (voice + text)** — shipped 2026-07-08 (marketplace `e5bb715`, connector `8a08aea`, both deployed + pushed). Replaces deprecated Telnyx call-in onboarding. Both modes enrich the verified member via `marketplace-onboard` enrich-in-place (full brain + Pinecone). *Follow-up (optional): the live conversation prompts (`onboardingSystemPrompt` text, `interviewVoicePrompt` voice) are marketplace-side and can be reworded/tuned without touching the connector profiling brain.*
- ✅ **Email (Resend)** — `RESEND_API_KEY` + `RESEND_FROM` now SET on prod (organizer blasts + invite emails send). `APNS_ENV` typo fixed (`sandboxA`→`sandbox`).
- [ ] **Real Pro card checkout** end-to-end test (only unverified payment link).
- [ ] **Places key:** lower per-minute quota (6000 → ~100) + add a **$50 GCP budget alert**.
- [ ] **RLS full sweep:** `device_tokens`/`products`/`orders`/`vendor_*` still open to anon and their clients use the anon key directly (`lib/push.ts`, `lib/vendor-connect.ts`, `app/api/uber/*`) — convert to service-role, then revoke.
- [ ] **Path A ownership** (Twilio-independent): Clerk phone possession + `trustedPhone` match → grant. Designed, not built. A new `phone_possession` claim method.
- [ ] **Connector → Supabase consolidation** (north star, phased — matching→pgvector, embeddings, assistant, enrichment).
- [ ] Email (Resend) keys still unset; App Store/TestFlight + NFC unchanged.
- ✅ **CORRECTION:** the "connector Firestore quota" blocker (below/older notes) was a **false alarm** — OTP 500s were from test member ids hitting Firestore's reserved `__…__` doc-id pattern, not quota. Real reads/writes work; **no Blaze needed.**

---

Follow-ups from the 2026-06-28 community / organizer / onboarding / NFC session.
Code is built and type-checks/lints clean; these are the deploy + config steps to
make it live, plus offered-but-unbuilt enhancements.

## �my Ship blockers (do these to go live)

- [x] **Apply migrations** — `supabase db push` **DONE 2026-06-28**. Applied all 12 pending
  (the session's 7 — `…130000`–`…190000` — plus 5 older never-pushed: broadcasts/featured/
  posts `20260608120000`–`150000` + `20260628120000`). Note: the **xeno** Supabase project
  (`xbbnvkvlrucrzobhopgh`) had **auto-paused** (free-tier ~7-day inactivity) — that was why
  pushes timed out; restoring it fixed it. If it pauses again, restore before any DB op.
- [ ] **Deploy the connector-agent** (`~/Desktop/dev/community-connector-agent`) — adds
  `marketplace-create-member` + `marketplace-onboard`. Member creation / all onboarding
  is a no-op until deployed. Verify `ADMIN_TOKEN` (connector) == `CONNECTOR_ADMIN_TOKEN` (here).
- [ ] **Set email keys** — `RESEND_API_KEY` + `RESEND_FROM` (verified sender domain) for
  organizer email blasts. SMS works once `CONNECTOR_URL` + `CONNECTOR_ADMIN_TOKEN` are set.
- [x] **Redeploy marketplace to Netlify** — **DONE** (shipped repeatedly this session; live at
  comfy-zuccutto-73b27f.netlify.app). Web changes go live via `netlify deploy --build --prod`
  (the iOS app loads the hosted `server.url`, so no `cap sync`/Xcode rebuild for web changes).
  Always run a local prod build + route smoke-test first (a route-slug collision took the site
  down once — see INSIGHTS).

## One-brain chat + in-app assistant (2026-06-28) — BUILT & DEPLOYED, blocked on Firestore quota

The Messages tab "WhatsLocal Assistant" now routes to the connector's shared brain
(same one SMS uses) via a new streaming endpoint, with a local-concierge fallback.
See memory `one-brain-chat-architecture.md` for full detail. Connector + marketplace
both deployed; `CONNECTOR_ADMIN_TOKEN` is set on the marketplace Netlify prod env.

- [ ] **🚨 Firestore over quota (connector Firebase project)** — `8 RESOURCE_EXHAUSTED:
  Quota exceeded`. Degrades EVERYTHING Firestore-backed right now: the in-app chat brain,
  **SMS**, and `marketplace-search` (directory search). Brain pipeline/env/auth/streaming
  all proven working — Firestore is just rejecting reads/writes. Fix = infra/billing on the
  connector's Firebase project: free Spark plan daily limit (resets midnight Pacific) or
  upgrade to **Blaze**. NOT a code issue. Once recovered, in-app chat returns real brain
  replies + directory search returns real members, no further changes.
- [ ] **Unify `sms.js` onto `lib/runChatTurn.js`** (connector) — currently chat.js +
  chat-stream.js share `runChatTurn`; sms.js still has its own copy of the pipeline. Unify
  so it's literally one orchestration (it already shares the brain libs). Test SMS after.
- [ ] **Member result-cards in connector replies** — the connector brain returns prose recs;
  the in-app UI can render member cards (`MEMBERS:[…]` markers) like the local fallback does.
- Done this session: `chat-stream.js` (v1 streaming, heartbeats — v2 functions don't get all
  env scopes on the connector site, Firebase creds were missing); lazy-init all OpenAI clients
  in the brain import chain (v2/streaming imports modules before env lands); `patch-member.js`
  re-embeds after a patch (profile edits from the app update Pinecone vectors).

## NFC (blocked on Apple)

- [ ] **Apple Developer Program enrollment** — currently **pending**. NFC needs an active
  paid membership.
- [ ] When active: Xcode → App target → *Signing & Capabilities* → **+ Near Field
  Communication Tag Reading** (Automatic signing registers it on the App ID). Confirm it
  links `App.entitlements`.
- [ ] Rebuild on a **physical iPhone** (NFC unavailable in the Simulator). Test by tapping
  a tag encoding `https://whatslocal.ai/members/<id>`.
- Note: the entitlement is NOT yet linked in the pbxproj, so current builds run fine; the
  NFC tab fails gracefully until the capability is live.

## Optional follow-ups (offered, not built)

- [ ] **Server-side facet filtering** — `marketplace-members` (connector) accepts
  `businessSize`/`ownership` params, so the home/explore filters query the whole catalog
  instead of client-side over loaded members.
- [ ] **Auto-tag QR self-onboards** with the event's group tag (carry a tag on the join
  link → apply in `/api/onboard/finalize`).
- [ ] **One-click "Added"** on a not-listed join request → connector `marketplace-create-member`
  + auto-add to lineup (instead of manual capture).
- [ ] **NFC write** — let a vendor write their `/members/{id}` URL onto a blank tag from the
  app (`NDEFReader.write()` / native `NFCNDEFReaderSession` write).
- [ ] **Attendee blasts** — SMS/email to RSVP'd attendees (separate from the vendor lineup;
  attendees already store contact info).
- [ ] **Paid event tickets** — extend free RSVP via Stripe Connect (needs a Connect account
  per organizer).
- [ ] **Tagged-group facet filtering** — filter an organizer's tagged roster by size/ownership.

## Pre-existing (carried from before)

- [ ] Composio + Trigger.dev config; repoint `whatslocal.ai` DNS; populate `lib/resources.ts`;
  Phase 3 voice receptionist. (See CLAUDE.md "Pending / TODO".)
