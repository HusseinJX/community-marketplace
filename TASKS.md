# Tasks

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
