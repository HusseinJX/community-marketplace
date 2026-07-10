# Changelog

All notable changes to this project are documented here.

## [Unreleased] — commerce, live, social shell (branch `feat/collab-rooms`)

### Added — Vendor Messages, conversational agent tuner, collab tiering — 2026-07-10
- **Vendor Messages inbox** (`/vendor/messages`, new nav tab): (1) **customer DMs** — real conversations customers had with the business agent (`app/api/vendor/messages` + `.../[conversationId]` over `chat_conversations`/`chat_messages`, `resolveActor`-gated), transcript inline; (2) pinned **"Your AI agent"** chat (`app/vendor/messages/assistant` + `components/vendor/VendorAgentChat.tsx` streaming `/api/chat/[memberId]`).
- **Conversational agent tuner** on `/vendor/assistant` — a **"Tune your agent"** panel (`components/vendor/AgentTuner.tsx`) that refines the customer-service agent by **chat or voice** ("make it less aggressive" → applies + confirms). `app/api/vendor/assistant/tune` = OpenAI tool-loop (`update_tone`/`add_note`/`remove_note`/`set_enabled`) editing `assistant_persona`+`business_knowledge` (the owner inputs `buildSystemPrompt` composes — never the fixed scaffold/tools/live facts). `app/api/vendor/assistant/voice` = OpenAI Realtime session grounded in the current config; the transcript is applied on hang-up (reuses `VoiceCall`). Demo actors preview without persisting.
- **Free can create self-hosted events** — Events unlocked on the vendor dashboard for every tier (`VendorHome`): CRUD + RSVP, no lineup/collaboration (that stays Pro).

### Changed — collab tiering, member-profile polish — 2026-07-10
- **Collabs tiered** (`NetworkManager`/`CollabsGate`): **Pro** = own + invite/add + New collaboration + Create-event in chat; **Basic** = read/chat only, all collaborations shown as **Joined** (no Owner badge), no invite/add, no Create-event; **Free** = inert **demo** (one demo collaboration + static demo chat + demo invites) with "you're not in the network yet — upgrade to Basic" notice cards. Removed the two redundant Free banners (`DemoBanner`, the `!canOwn` note in Free).
- **Inquire** button on member profiles now gated on the `textAssistant` entitlement (`ActionBar canInquire`) — no more dead button on free/unclaimed listings.
- **About** section header (vendor dashboard): left-aligned, blue **Edit** pill + gray **View profile** pill.
- **Resources** tab: removed the "Link your business" gate and the `CollectivePromoModal` "See how it works" popup/button.
- **`/browse`**: back-to-home button + Feed/Events/Shop quick-nav pills.
- **Seed member `89516919-…` reworked into "Xeno"** — personal founder profile (SF) with 4 XENO merch tees + 4 hero artworks (Supabase Storage; host added to `next.config`) + 3 host-your-own **Atlas** events (immersive cultural journeys). Old Zahab hero images/endorsements/demo-feed refs repointed.

### Added — /join in-app onboarding interview (voice + text) — 2026-07-08
Deployed to prod (connector → Netlify; marketplace → CapRover `marketplace` v17). Commits `e5bb715` (marketplace) + connector `8a08aea`.
- **New interview step in `/join`** (`app/join/JoinFlow.tsx`) between verification and the plan picker. After the member is created + verified/claimed, the person picks **Talk it out** (in-browser OpenAI Realtime **voice**, WebRTC — same plumbing as the business voice agent, no phone number), **Type it** (the `/onboard` chat brain), or **Skip**. `components/join/JoinInterview.tsx` drives the choose/text/voice surface.
- **Both modes enrich the just-verified member via the connector's FULL profiling brain.** Transcript → `POST /api/join/enrich {memberId, messages}` → `onboardFromMessages(messages, { memberId })` → connector `marketplace-onboard`, which gained an optional **`memberId` = enrich-in-place** path: same `buildSystemPrompt` profiling (~45-field schema), price normalization, `enqueuePostSave` enrichment, and Pinecone re-embed — run against the existing member instead of minting a new id. **Protects the verified anchors** (name, memberType, claim status, phone/businessPhone/trustedPhone, googleMapsUrl, lat/lng, city) from being overwritten. Backward-compatible: no `memberId` = unchanged create path (booth QR onboarding untouched).
- **Voice plumbing:** `app/api/onboard/voice/route.ts` mints the interviewer Realtime session with `interviewVoicePrompt()` (`lib/onboard.ts`); **not** Pro-gated (person is mid-join), bounded by Clerk sign-in + `VoiceCall`'s 5-min cap. `components/VoiceCall.tsx` is now parameterized (`tokenUrl`/`tokenBody`/`onTranscript`) and harvests the transcript from the `oai-events` data channel; existing business calls unaffected.
- **Replaces the deprecated Telnyx call-in onboarding** (connector `voice-tool.js` / Telnyx Voice AI Assistant). That path is dead/unused — this in-app interview is the onboarding now, and is actually richer (profiles the whole conversation vs. relying on the agent to fill a tool) and lower-latency (direct WebRTC, speech-to-speech, no PSTN hop).

### Launched — SF launch: tiers, payments, verification, security, enrichment — 2026-07-08
Went LIVE on prod (`whatslocal.ai` / CapRover). Full write-up: `session-context/2026-07-08-sf-launch.md`.
- **Demo mode OFF** in prod (`NEXT_PUBLIC_DEMO_MODE=0`) — `/vendor/*` now requires real Clerk auth. Added johnxen to `ADMIN_CLERK_USER_IDS`.
- **Tier model finalized** (`lib/entitlements.ts`, `BillingPlans.tsx`): **Free** = posts + discovery (community/resources); **Member $10** = + text agent + *receive* invites + claimed profile; **Pro $30** = + *send* invites + organize + booking voice agent + commerce. Launch discounts via **Stripe coupons**, not an app flag (removed the `NEXT_PUBLIC_LAUNCH_PROMO` approach).
- **Real Stripe subscription payments LIVE** — live keys + `STRIPE_PRICE_MEMBER` ($10/mo) / `STRIPE_PRICE_PRO` ($30/mo) + `STRIPE_SUBSCRIPTION_WEBHOOK_SECRET`. Created the missing `subscriptions` table + `posts.location` column on prod (migration history was out of sync). Checkout→webhook→`subscriptions`→entitlements verified. *(One unverified link: a real card checkout.)*
- **Removed all unconditional fake-demo fallbacks** (14 files; deleted `lib/demo-events.ts`) so the **440 real** businesses show. Petitions left as-is (no DB backing).
- **Seed** (`scripts/seed-launch.mjs`): realistic `broadcasts`/`posts`/`featured_lists` from real connector members (idempotent). Ran on prod (8/10/2).
- **Security:** RLS hardening — set `SUPABASE_SERVICE_ROLE_KEY` on prod (app writes via service-role, bypasses RLS), then **revoked anon grants** on `subscriptions`/`collab_*`/`posts` (migration `20260708120000_harden_table_grants`). In-memory **rate limiting** (`lib/rate-limit.ts`) on OTP/posts/upload/invites (works because CapRover = persistent container).
- **Twilio Verify OTP** — connector business-ownership OTP swapped Telnyx→Twilio Verify (`lib/twilio.js` + `otp.js`; SMS + voice fallback, no code at rest, no 10DLC). Verified working. Designed but not built: **Path A** — Twilio-independent ownership via Clerk phone possession + in-person `trustedPhone` match.
- **Enrichment (prolocaliq-style):** added a **Perplexity `sonar` web-search "story" layer** to the connector `enrich.js` + a `story` field (works with no website; tested on real businesses). Activated the dormant **Google Places** enrichment (fresh `GOOGLE_PLACES_API_KEY`). Built a server-side Places proxy (`lib/places.ts` + `/api/places/search|details`, key off-browser) and a **"search Google → pick → auto-fill" create UI** in `AdminPanel`.
- **Crons:** disabled `harvest-oakland`/`harvest-events`/`followup-intros` (env-flag guarded), kept `prune-collab-pool`; deployed to Trigger.dev.
- **Correction:** the "Firestore quota" issue was a **false alarm** — OTP 500s were from test member ids hitting Firestore's reserved `__…__` doc-id pattern; real members work, no Blaze needed.
- **Direction set:** consolidate the connector into the marketplace/Supabase (+`pgvector`) as a deliberate future north star (UI-first pivot obsoletes its conversational premise); not urgent.


### Changed / Fixed — UI polish + RSC fixes — 2026-06-30
- **Live page = the events surface**: added `components/live/CommunityEventsLive.tsx` below the venue "what's on right now" feed — real community events (`/api/events/feed`) split into **Events happening now** (today) + **Upcoming**, each with place filter tags, plus a **Feed / Map** view toggle (`EventsMap`/`EventsMapInner`, Leaflet pins placed by city/neighborhood centroid since `vendor_events` carry no lat/lng). Demo fallback floats event dates relative to now. `FeedEvent` gained an `eventDate` field for tz-safe now/upcoming bucketing.
- **TopNav dropdown** trimmed to **Home / Feed** — the **Events** item was removed (events now live on the Live tab).
- **Vendor dashboard commerce toggle**: extracted Products/Orders/Events + manage buttons into `components/vendor/CommerceCards.tsx` with a persisted **Commerce** on/off switch (default on). Replaces the always-locked-in-demo gating — Products/Orders are disabled only when the toggle is off.
- **Super-admin consolidation**: removed **Super-admin** + **Featured** from the dashboard Tools grid. `/vendor/admin` is now the single entry point (direct URL, `isAdmin`-gated); **Featured lists** is a 4th tab inside `AdminPanel` (`?tab=featured`). Act-on-behalf search now **normalizes** the connector member shape (`profile.name`/`memberType`/`city` → flat) so results/manage views show text, and persists the active **tab + picked member in the URL** so "Go back" / browser-back returns to the managed member instead of resetting to the Create tab. Wrapped in `<Suspense>` for `useSearchParams`.
- **Share composer "Go Live"**: a vendor-mode toggle (persisted) reveals a Go Live block — suggested live/upcoming fixtures, event picklist, matchup, "rooting for", duration — posting to `/api/broadcasts/:memberId` for the tagged venue.
- **Explore** category/facet filters are now a single horizontal scroll row.
- **Footer** gained a **Community events** link → `/vendor/organize`; **Organize events** removed from the Tools grid; Collabs (`NetworkManager`) membership defaults to **Basic**.
- **`HappeningThisWeek`** no longer renders the "Nothing scheduled yet" card — it self-hides when the feed is empty.
- **Fixed Clerk "multiple children" crash (RSC boundary)**: `SignInButton`/`SignOutButton` with a custom child throw when rendered from a Server Component. Made `app/shopper/page.tsx` a client component and moved the vendor sign-out into `components/vendor/VendorSignOut.tsx` (client). All six other Clerk-button usages were already `"use client"`.

### Added — Super-admin hub, AI-image premium quota, event organizers — 2026-06-28
- **`/vendor/admin`** super-admin hub (`AdminPanel.tsx`, isAdmin-gated): Create profile · Add by transcript · Act on behalf (member search → deep-links to manage any business's events/products). Surfaces the previously-hidden onboard flow; no more hand-typed `?memberId=` UUIDs.
- **AI product-image generation is now premium** (`lib/ai-credits.ts` + `ai_image_credits` table, migration `20260628200000`): 3 free lifetime per member, 3-per-scan cap (extras returned as raw-crop drafts), 10/day for premium; admins bypass. Over-limit → 402/429 + upgrade banner. Placeholder `/vendor/billing`.
- **Event-organizer sub-type** (`organizerFocus` in `lib/org-focus.ts`) distinct from community-service orgs; **multi-role lineups** (`lib/lineup-roles.ts`: vendor/performer/food/sponsor/partner/volunteer) in `/vendor/organize`; the **public event page** now renders the lineup grouped by role + "Public event" badge.
- **Real events in the community feed**: `GET /api/events/feed` + `getPublicEvents()` merge live `vendor_events`/connector events ahead of the demo feed (was demo-only).
- **Deployed** the connector `marketplace-create-member` + `marketplace-onboard` functions to prod; verified the admin-token chain; set `CONNECTOR_ADMIN_TOKEN`/`CONNECTOR_URL` locally.

### Added — One-brain in-app assistant (connector chat + embeddings-from-app) — 2026-06-28
- **Messages tab** leads with a pinned **WhatsLocal Assistant** conversation (`/messages/assistant`, `components/messages/AssistantChat.tsx`) — the same brain people text over SMS, in-app. `app/api/assistant/chat` proxies the connector's new **streaming** `chat-stream` endpoint (stable per-device `sessionId`), with a **local concierge fallback** (searches the live directory) when the connector is unavailable/erroring — so the tab never breaks.
- **Connector-agent (separate repo, deployed):** extracted the per-turn brain into `lib/runChatTurn.js` (chat.js delegates to it — one orchestration for web + app); added `chat-stream.js` (v1 streaming via `@netlify/functions` `stream()` + heartbeats, so it survives the ~30s edge cutoff; v2 functions don't get all env scopes on that site); made every OpenAI client in the import chain lazy; `patch-member.js` now **re-embeds** after a patch, so profile edits made in the app update Pinecone vectors. **Known blocker:** the connector's Firestore is over quota (`8 RESOURCE_EXHAUSTED`), degrading the brain, SMS, and `marketplace-search` until the Firebase quota is restored (Spark daily reset / Blaze). See `TASKS.md`.
- **Resilience:** `lib/api.ts getJson` now has a **4.5s timeout** (`AbortSignal.timeout`) so slow/erroring connector calls fail fast and pages fall back to demo/cached data instead of hanging ~8s.

### Added — Community resource explorer for residents (`/resources`) — 2026-06-28
- A separate, resident-facing resource hub (food, housing, health, legal aid, financial help, family, jobs, immigration, seniors, community orgs) — same look as the vendor hub but its own content + a **public AI guide**. `lib/community-resources.ts`, `app/resources/page.tsx`, `app/api/resources/chat` (grounded on the community catalog). `ResourceChat` parameterized (`endpoint`/`catalog`/`subtitle`/`starters`); shared `CATEGORY_META` extended with community categories. Shopper "Your space" consolidated to one "Explore local resources" entry → `/resources`.

### Added — Petitions & causes (`/petitions`) — 2026-06-28
- A home for local petitions so people find + sign them on their own time. Browsable feed with category chips + live progress bars; optimistic localStorage signing (demo content for now, no DB). `lib/demo-petitions.ts`, `app/petitions/page.tsx`, `components/petitions/PetitionsClient.tsx` (+ `PetitionsRail`, not currently surfaced). Reachable from the shopper space.

### Added — SF city hub with endorsed spots + newcomer articles (`/sf`) — 2026-06-28
- `/sf` hero + a toggle: **Endorsed** (default) — real SF/Bay spots loved/backed by real celebrities, with their Wikipedia/Wikimedia photos and an initials fallback (`SF_ENDORSEMENTS` in `lib/sf-stories.ts`, `components/sf/SfExplorer.tsx`) — and **Featured stories**, now full **articles** at `/sf/[id]` (`getSfStory`, `generateStaticParams`) written for newcomers (Karl the fog/microclimates, a city of villages, getting around, the Mission burrito/murals, North Beach & the Beats, Chinatown, Ferry Building, Castro).

### Added — Where to watch the World Cup (`/watch-world-cup`) — 2026-06-28
- A curated highlight of SF's best World Cup **watch parties** (evergreen — not live matches): Thrive City, Chase Center, Spark Social, China Basin Park, The Crossing at East Cut, Yerba Buena Lane. `lib/wc-watch-parties.ts`, `app/watch-world-cup/page.tsx`. Hero **"Watch World Cup"** button links here (was `/live?event=world-cup`). The live feed's `?event=` deep-link still works and now shows an event-aware "Where to watch the {event} in SF" header with **lean** cards (no event/team chips or per-card tags) via a `locked` flag.

### Added — Live "Go Live" what's-on shortcut — 2026-06-28
- The vendor **Go Live** composer shows a tappable strip of games happening now / soon (`lib/live-fixtures.ts`, relative-time like demo-live) — tap one to pre-fill the matchup + event (live → "now" mode, upcoming → "schedule" with kickoff time).

### Added — Featured promo cards in feed + directory — 2026-06-28
- **XEN0 × WhatsLocal merch** card (`components/feed/MerchCard.tsx`) and **Atlas** events card (`EventsCard.tsx`) injected after the 3rd / 6th card in the Community Feed and the home directory grid (vertical layout, hero image, placeholder links to swap).

### Added — Feedbase feedback widget — 2026-06-28
- `components/FeedbackWidget.tsx`: loads the Feedbase `widget.js` app-wide + identifies the Clerk user; a subtle **Send feedback** link in the footer opens the modal (the widget's own floating pill is hidden via `#fb-btn` CSS).

### Changed — Native app feel, footer, nav, filter sidebar, hero — 2026-06-28
- **Long-press callout fix:** global CSS disables the iOS WKWebView callout (Open/Copy/Share) + tap-highlight on links/buttons/images; text content stays selectable.
- **Footer** moved to `components/SiteFooter.tsx` (client) — **hidden on `/messages`** so the conversation view has no footer and its input bar pins above the bottom nav. Footer links trimmed (removed Feed/Shop/Categories; **Admin demo** → `/vendor`; **Send feedback**).
- **Hero buttons:** removed the old Shopper/Admin buttons; added **Watch World Cup** + **SF**.
- **Filter sidebar** (`components/FilterSidebar.tsx`) slides from the **left**, full-height, starting below the navbar (was a floating card / right side).
- **Home order:** the search bar moved **above** "Live now near you".

### Fixed — Collabs card horizontal overflow + events label — 2026-06-28
- `/vendor/network` cards extended past the viewport: the flex/grid **card itself** lacked `min-w-0`, so it grew to its content's min-content (~434px on a 390px screen). Added `min-w-0` to the cards (+ `block truncate` on the name Link, `break-words` on chat bubbles). Verified with the browser tool: `scrollWidth === clientWidth`.
- Events "Create event" button → **"Create"**.

### Changed — Vendor portal UX + demo access + shipped to prod — 2026-06-28
- **Slim one-row top nav** (`components/vendor/VendorNav.tsx`): Home · Live · **Collabs** (→ `/vendor/network`, find & invite) · Resources · QR. Pill style with **active/selected** highlight + hover/press feedback; fits the viewport (no horizontal scroll). Other tools moved to a dashboard **Tools** grid: **Your agent** (renamed from Assistant) · Giving (+ Featured for admins). **Organize** lives under My Events (button in the events header); **Onboard** hidden; **Network** is the Collabs tab.
- **"Go back" bar** (`components/vendor/VendorBackBar.tsx`) below the navbar on deeper pages (hidden on the 5 nav-tab destinations) → returns to the previous screen.
- **Demo shows everything**: gated vendor pages now resolve a representative demo member in demo mode (`lib/demo-server.ts` `demoMemberId()` by demo-type cookie) instead of the "link your profile" gate. Demo *writes* still no-op (`resolveActor` has no demo path).
- **Floating resources guide**: the `/vendor/resources` chat is now a sticky bottom-right circle button that expands a chat panel (`components/resources/ResourceChat.tsx`); catalog is full-width.
- **Shopper "Explore local resources"** opens the resources hub; demo banner removed.
- **Shipped:** deployed to Netlify prod (the iOS shell loads the hosted site, so web changes go live via `netlify deploy --build --prod`, not `cap sync`). **DB migrated:** `supabase db push` applied all 12 pending migrations after restoring the auto-paused xeno project.

### Added — Assistant knowledge via PDF drop-in + slim vendor nav — 2026-06-28
- Vendors configure their customer-service AI's knowledge by **typed notes or dropping PDFs** (`/vendor/assistant`): new `app/api/vendor/assistant/upload` extracts PDF text with `unpdf` → `business_knowledge` (`source: 'pdf'`), fed into `buildBusinessContext`. Persona/prompt + FAQs editing already existed.
- Vendor top nav slimmed to one row: **Home · Live · Collabs · Resources · QR**; Organize/Onboard/Network/Giving/Assistant/Featured moved to a dashboard **Tools** grid. Demo "viewing as" banner removed. Shopper "Explore local resources" now opens the resources hub.

### Added — Community memories (tagged-media walls) — 2026-06-28
- Posts tagged to a business/event/broadcast aggregate into an IG-style media wall + lightbox (`components/posts/MemoriesGrid.tsx`), on `/members/[id]`, `/events/[id]`, `/live/[id]`. `getPostsByMemberId`/`getPostsByEventId`; `GET /api/posts?member=|event=`; migration `20260628130000` (event index). Self-hides when empty.

### Added — Community giving + "Gives back" credit — 2026-06-28
- Vendor logs an open-ended gift (funds/goods/time/other) to a community org → org confirms via a self-serve inbox → public "Gives back" badge on the vendor profile. `/vendor/giving`, `lib/contributions.ts`, `community_contributions` (migration `20260628140000`), `components/giving/GivesBackBadges.tsx`.

### Added — Org typing + business facets + home filter sidebar — 2026-06-28
- Community orgs carry `serves` (small-businesses / individuals); `lib/org-focus.ts`, "Who they serve" chips.
- Businesses carry `businessSize` + `ownershipTags[]` (`lib/business-facets.ts`); captured at onboarding, editable on the profile (`components/business/BusinessFacets.tsx` → `PATCH /api/members/[id]/facets` → connector `patch-member`).
- Filterable via a slide-in `components/FilterSidebar.tsx` opened from a filter button in `SearchBar` on the home screen (+ on `/explore`). Client-side `matchesFacets`.

### Added — Collaborator network (invites + rooms) — 2026-06-28
- `/vendor/network`: search the local network → send a collab invite → accept → self-contained 1:1 room + polling chat. `lib/collab-network.ts`, `collab_invites`/`collab_rooms`/`collab_messages` (migration `20260628150000`). No connector-agent dependency.

### Added — Organizer toolkit (Luma-style) — 2026-06-28
- `/vendor/organize`: pick an event → **Lineup** (search vendors, multi-select, bulk-invite; event-scoped `collab_invites`) + **Messages** (group thread + **SMS/email blast** to the accepted lineup) + **Attendees**. `lib/event-comms.ts`, `lib/sms.ts` (connector proxy), `lib/email.ts` (Resend REST, no SDK). `event_messages` (migration `20260628160000`).
- **Free RSVP / attendees**: `vendor_events.capacity` + `event_attendees` (migration `20260628170000`), `lib/attendees.ts`, `components/events/RsvpButton.tsx`. `/events/[id]` now resolves organizer (`vendor_events`) events for a public RSVP page; member-profile event cards link there.

### Added — Pre-tagged venue onboarding + member creation — 2026-06-28
- Per-event **join QR** (in `/vendor/organize`) → conversational onboarding. Find-existing-listing path at `/events/[eventId]/join` (self-join → pending lineup; not-listed → `event_join_requests`, migration `20260628180000`).
- **Members can now be created** (not just claimed): connector functions `marketplace-create-member` + `marketplace-onboard` (the latter runs the connector's own profiling brain over a transcript → full profile + Pinecone vectors). `lib/api.ts` `createMember`/`onboardFromMessages`/`patchMember`.
- **Manual interview** tool `/vendor/onboard`: paste a conversation → AI extracts a reviewable profile (`lib/onboard.ts`, `/api/onboard/extract`) → create + optional event lineup + **grouping tags** (`member_tags`, migration `20260628190000`, "farmers market" etc.) with bulk-add-to-lineup.
- **QR self-onboarding** `/onboard?event=`: in-app booth chat (`/api/onboard/chat`) → `/api/onboard/finalize` (connector profiling + infers size/ownership facets + tags the lineup).

### Added — LinkedIn-style code sheet + native iOS NFC — 2026-06-28
- Home search-bar scanner rebuilt as a tabbed **Connect** sheet (`components/QrScanButton.tsx`): **NFC tag** (default) + **Scan** (camera). NFC priority: native iOS Core NFC → Web NFC (Android) → unsupported (`lib/native-nfc.ts`).
- Native plugin in `whatslocal-ios/local-plugins/capacitor-nfc/` (Swift `NfcPlugin`, `NFCNDEFReaderSession` → `Capacitor.Plugins.Nfc.scan()`); synced into SPM + `packageClassList`; Info.plist + `App.entitlements` added. Gated on Apple Developer Program enrollment + a physical device.

### Added — Native Composio commerce + Trigger.dev
- Brought Composio in-app (was a connector-agent proxy): `lib/composio.ts` (`@composio/core` client + `runTool`/`TOOL_SLUGS`/auth-config helpers) + `lib/composio-commerce.ts` (`connectStore` / `syncVendorCatalog` / `pushOrderToStore` / `getConnectedMemberIds`).
- `/api/vendor/composio` native connect + sync; Stripe webhook fires native `pushOrderToStore` order push-back.
- Shopify OAuth needs the vendor's **store subdomain** (`{shop}.myshopify.com`) — collected in the connect UI, passed via `AuthScheme.OAuth2({ subdomain })`.
- **Trigger.dev** project for this repo (`trigger.config.ts` + `trigger/composio.ts`): daily 3am `sync-all-catalogs` cron + on-demand `sync-vendor-catalog`; `/api/vendor/composio` falls back to inline sync when `TRIGGER_SECRET_KEY` is unset.
- Shopify (own app, custom OAuth) + Square (Composio managed) auth configs wired; verified against the live Composio API. See `features/composio-go-live-checklist.md`.

### Added — Live Now / World Cup discovery
- "Live Now" broadcasts (venues post what they're showing) + featured rails + World Cup host-city guides, with demo fallbacks (`app/live`, `app/featured`, `app/world-cup`, `components/live/*`, `lib/broadcasts.ts`/`demo-live.ts`/`featured.ts`/`live-events.ts`). Migrations `20260608120000`–`…150000`.

### Added — Instagram-style app shell
- `components/TopNav.tsx` — left `+` (→ `/share`), center **WhatsLocal ▾** dropdown (Home / Feed / Events), right cart. Replaces the old `auth-nav` header.
- `components/BottomNav.tsx` — Home / Reels (`/live`) / Messages (`/messages` stub) / Search (`/explore`) / Profile (`/shopper`).
- `app/explore` — IG Explore-style full-bleed square-tile grid of local businesses + name search.
- Safe-area handling (`viewport-fit=cover`, notch padding, locked scale to stop iOS input-zoom); `overflow-x-hidden` + `min-w-0` filter rows fixed mobile horizontal overflow; filter pills → horizontal scroll, uniform size.

### Added — Share composer + posts
- `app/share` + `components/share/ShareComposer.tsx` — Twitter/IG-style composer: text, image/video upload, tag a **business or event** (search **or QR scan**, auto-detects `/members` vs `/events`·`/live`), livestream link.
- `app/api/posts` (GET feed / POST create), `app/api/share/upload` (any signed-in user, demo-friendly), `lib/posts.ts`, migration `20260628120000_add_posts`. Demo mode soft-succeeds when the table isn't pushed yet.

### Added — Demo mode (testable admin/shopper without auth)
- `NEXT_PUBLIC_DEMO_MODE=1` opens the portal without Clerk for previewing each member type's admin UI. `lib/demo-admin.ts` + `components/DemoTypeSwitcher.tsx`; `middleware.ts` + `app/vendor/layout.tsx` skip auth in demo; `/demo` admin type picker.
- Home hero buttons: **Shopper admin** (`/shopper`) + **Admin demo** (`/vendor`). `app/shopper` shopper dashboard with sign-in/account control above "Your space".
- Vendor dashboard slimmed: compact Products/Orders/Events metric grid + Products/Events manage buttons.

### Roadmap specs (`features/`)
- `business-model.md`, `native-app.md` (Capacitor iOS — scaffolded in sibling `whatslocal-ios`), `storefront-theming.md`, `product-3d.md`, `virtual-tryon.md`, `event-photo-wall.md`, `community-directory.md`, `composio-go-live-checklist.md`.

## [Unreleased] — AI layer (branch `feat/ai-customer-service-assistant`)

### Added — Phase 1: Per-business customer-service assistant
- Auto-provisioned AI chat assistant on every `vendor`/`artist`/`organizer` profile (`components/AskAssistant.tsx`), streaming, grounded in that business's own data.
- `lib/business-context.ts` — assembles profile + products + events + settings + owner FAQs into a prompt (context-stuffed RAG; no vector store).
- `app/api/chat/[memberId]` — streaming chat route with a tool loop: `capture_lead` + `check_order_status`. Persists transcripts; returns `X-Conversation-Id`.
- `app/vendor/assistant` — owner config: enable/disable, tone, custom FAQs, captured-leads inbox.
- `lib/openai.ts` — lazy OpenAI client + model constants.
- Tables: `business_knowledge`, `chat_conversations`, `chat_messages`, `chat_leads`; `vendor_settings.assistant_enabled` / `assistant_persona`.

### Added — Phase 2: Image → catalog capture
- Snap a photo to populate the catalog, all behind an approval queue (`active=false` drafts → Approve).
  - **Scan a menu** → `gpt-4o` vision extracts items + prices → product drafts.
  - **Scan a flyer** → extracts event details, keeps the photo as the poster → event draft.
  - **Scan a counter/shelf** → vision bounding boxes → `sharp` crop → `gpt-image-1` clean product image → drafts (experimental; raw-crop fallback).
- Product write paths added to `app/api/products/[memberId]` (`POST/PATCH/DELETE`); new `vendor_events` table + `app/api/events/[memberId]`.
- `app/vendor/products` + `app/vendor/events` CRUD managers with draft-approval queue.
- `components/ImageCaptureUploader.tsx`, `app/api/upload`, `app/api/ai/extract`, `app/api/ai/detect-products`.
- `lib/admin.ts` — `ADMIN_CLERK_USER_IDS` allowlist + `resolveActor()` gating all writes (vendor on own member; admin on any via `?memberId=`).
- `lib/storage.ts` + `marketplace-media` public Storage bucket (created via migration).
- Published `vendor_events` surfaced on the member profile and fed into the assistant's context.

### Added — Small-business resources hub (`/vendor/resources`)
- Searchable, category-filterable catalog of local small-business support resources (legal, accounting, energy, green, accessibility, permits, funding, education, market research, library, support orgs) — everything in one place.
- "Recommended for you" rail: deterministic, rule-based matching of resources to the business's own profile (`recommendResources` in `lib/resources.ts`), e.g. a restaurant gets induction/green/accessibility picks with a plain reason. No model call, unit-tested, free.
- Grounded chat guide (`app/api/vendor/resources/chat`, streaming) that explains resources and renders them as inline cards via a `suggest_resources` tool.
- `lib/resources.ts` — static catalog (editing data = editing the file) with `tags`/`recommendFor`/`city`/`cost` shaped for later improvement; unverified entries render a "Find this program →" search link instead of a fabricated URL.
- UI: `app/vendor/resources/page.tsx`, `components/resources/{ResourceCard,ResourceGrid,ResourceChat}.tsx`; vendor nav link + dashboard quick-access card.
- `tests/resources.test.ts` — unit tests for the recommender + catalog integrity (no API cost).
- **v1 ships a placeholder seed (5 entries); real resource curation is the remaining work** (see CLAUDE.md "Pending / TODO").

### Added — QR codes (basic) + marketplace scanner
- Vendor portal `/vendor/qr`: client-side QR generator pointing at the vendor's profile (`…/members/{id}`), color presets, PNG + SVG download. Pure (`lib/qr.ts` via `qrcode`) — no AI, no network.
- Marketplace: a QR-scan button beside the search bar (`components/QrScanButton.tsx`, `@zxing/browser`) opens the camera and routes a scanned profile code straight to that member page.
- **Tiered + independent by design:** basic generation and the scanner share no code and import nothing AI-related, so they can't be broken by the AI tiers. AI poster will be a separate file behind `NEXT_PUBLIC_QR_POSTER` (still unbuilt). Note: camera scanning requires HTTPS or localhost.
- Vendor nav link + dashboard quick-access card.

### Added — QR codes (AI-stylized, Tier 1, flag-gated)
- `app/api/vendor/qr/stylize` (flag `NEXT_PUBLIC_QR_AI=1`, **off by default**): `gpt-image-1` generates a background, then the **real** QR is composited on a white card over it (`lib/qr-compose.ts` via sharp) and uploaded to Supabase. Because the real QR sits on top, the output always scans even with a busy background; if the AI call fails the UI falls back to the basic generator.
- `components/qr/AiQr.tsx` — style presets + optional prompt + download; only mounted when the flag is on. Each generate is a billable `gpt-image-1` call (~$0.04).
- `tests/qr.test.ts` — deterministic, **free** (no OpenAI): composites a QR over a noisy synthetic background and decodes it back (`jsqr`) to prove scannability + output dimensions.
- **Verified live once** end-to-end (real `gpt-image-1` background → composite → `jsqr` decoded back to the exact profile URL): the AI background does not break scannability in practice. To enable in any environment: set `NEXT_PUBLIC_QR_AI=1` (and `OPENAI_API_KEY`).
- Independent + revertible: AI files import sharp/gpt-image-1; `lib/qr.ts`/`BasicQr` import none of it, so unsetting the flag or deleting the AI files leaves basic + scanner intact.

### Added — Testing
- Vitest live integration suite (`tests/`) exercising real OpenAI + Supabase: DB CRUD, assistant grounding, vision extraction, `gpt-image-1` generation, counter detection + crop, Storage upload. `npm test`.

### Fixed
- Granted `anon`/`authenticated` privileges on `vendor_profiles`, `orders`, `vendor_settings`, `stripe_connect_accounts`, and `products` (write) — the original migrations created open RLS but no role grants, so anon-key access failed with `42501`. (Surfaced by integration tests.)
- `extract`/`detect` routes now fetch image bytes server-side and send them to OpenAI inline (base64) instead of passing Supabase storage URLs, which OpenAI's downloader handled slowly/unreliably.
- Synced the live `xeno` Supabase DB, which was behind by the `2026-05-18` migration set (orders, vendor_settings, delivery fields, vendor_profiles Clerk rename).

### Setup required
- Set `OPENAI_API_KEY` (optional: `ADMIN_CLERK_USER_IDS`, `SUPABASE_SERVICE_ROLE_KEY`).
- `supabase db push` to apply the new migrations (assistant tables, `vendor_events`, media bucket, grants).

### Not yet built
- Phase 3 — voice AI receptionist (OpenAI Realtime + Twilio) and a reservations/booking subsystem.
