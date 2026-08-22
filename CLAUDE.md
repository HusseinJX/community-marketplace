@AGENTS.md

# Community Marketplace

## What This Is
A Next.js 16 (App Router) community marketplace that lets users browse local members, makers, and events. All auth is Clerk — shoppers use optional modal sign-in; vendors use a dedicated protected portal at `/vendor/*`.

**This file is the index, not the archive.** Detail lives in `docs/context/` — read the relevant file before working in that area:

| File | What's in it |
|---|---|
| `docs/context/architecture.md` | Full per-surface map: every route, component, API, feature subsystem |
| `docs/context/ios-shipping.md` | Full App Store rules, APNs env, native-vs-web split |
| `docs/context/pending.md` | Full TODO backlog, unverified features, blocked items |
| `docs/context/decisions.md` | Dated decision log — why things are the way they are |
| `docs/context/conventions.md` | Full key conventions (the subset below is the load-bearing part) |
| `docs/context/database.md` | Every Supabase table + what it's for |
| `docs/context/environment.md` | Every env var, how it's obtained, what breaks without it |
| `docs/context/observability.md` | Sentry + PostHog full write-up |
| `docs/context/auth.md` | Auth architecture + commerce layer detail |
| `docs/context/demo-mode.md` | Demo mode detail |
| `docs/context/seo.md` | SEO/AEO layer |

Also: `TECH-DEBT.md` (deferred problems + why), `features/` (forward roadmap specs), `docs/vendor-setup-guide.md` + `docs/phone-forwarding-by-carrier.md` (client-facing), `session-context/` (session write-ups), `CHANGELOG.md`.

## ⚠️ SHIPPING RULES — the iOS app is LIVE ON THE APP STORE
**Read `docs/context/ios-shipping.md` before every deploy.** The shipped app is a thin native shell loading the **live hosted site** (`server.url: 'https://whatslocal.ai'`), so **a CapRover deploy IS an app update** — it reaches every App Store user on next launch, no review, no rollback. The condensed rules:

1. **NEVER render a Stripe subscription checkout when `isNativeApp()`.** iOS sells subscriptions via StoreKit IAP (`/vendor/billing` → `lib/native-iap.ts`); web keeps Stripe; both write the same `subscriptions` table. **Any price shown natively MUST come from StoreKit** — a hardcoded "$30/mo" on a native surface is the rejection. Restore Purchases must stay reachable. The server derives the plan from the verified `productId`, never from the client. **Physical goods, tickets, bookings and deliveries stay on Stripe Connect** — 3.1.1 doesn't cover them.
2. **NEVER enable the ad pixels without wiring ATT first** (`NEXT_PUBLIC_META_PIXEL_ID` / `NEXT_PUBLIC_GOOGLE_ADS_ID` / `NEXT_PUBLIC_GA4_ID`). Flipping these on a web deploy makes our App Review "no tracking occurs" statement false.
3. **Don't ship a web change that raises the age rating or adds a reviewable capability.** Keep any new UGC surface inside the moderation stack.

**Requires a new Xcode build + App Review** (compiled into the IPA): splash/icon, app name/version, `capacitor.config.ts` itself, Capacitor plugins, `Info.plist` strings, `App.entitlements`, the `www/` offline page.

**APNs:** prod has `APNS_ENV=production`, which is CORRECT for App Store builds — don't "fix" it. A local Xcode debug build gets a *sandbox* token that prod rejects and prunes; that's not "push is broken".

**No forced-update mechanism exists** — keep web changes backward-compatible with the shipped native bridge (`lib/native-*.ts`).

## ⚠️ THE BUILD TRAP
`NEXT_PUBLIC_*` is inlined at build time and `next build` loads `.env.local` (demo `=1` locally). `.env.production.local` pins `NEXT_PUBLIC_DEMO_MODE=0` and `pk_live` — **never remove those lines.** The pre-deploy gate is mandatory, every time:

```
PORT=3100 npx next start
curl -sI localhost:3100/vendor    # MUST be 307 → /vendor/sign-in
```

A **200 means demo mode is baked ON** — that build must not ship; it would open the whole vendor portal (products, orders, customer DMs) to every App Store user, unauthenticated. **Grepping the bundle does NOT work** (minification folds the constant away). Detail: `docs/context/demo-mode.md`.

## Architecture — the shape
Full map in `docs/context/architecture.md`. Orientation:

- **App shell** = Instagram-style nav (`app/layout.tsx` + `ClerkProvider`/`StoreProvider`): `components/TopNav.tsx` + `components/BottomNav.tsx`, safe-area aware.
- **Home** `app/page.tsx` — tabs `Events · Feed · Shop`; Events has a For you / What's on toggle (`components/feed/PersonalizedEvents.tsx`).
- **Shopper surfaces**: `/explore`, `/share`, `/shopper`, `/messages` (WhatsLocal Assistant), `/events`, `/live`, `/cart`, `/checkout`, `/favorites`, `/tickets`, `/resources`, `/petitions`, `/sf`.
- **Member profiles** `app/members/[id]` (server components) — claim banner, business facets, memories wall, giving badges, `AskAssistant` widget.
- **Vendor portal** `app/vendor/*` (Clerk-protected): dashboard, products, events, orders, messages (customer DMs + own agent), network/collabs, organize (lineup + blasts + tickets + attendees), assistant, integrations, billing, qr, live, checkin, bookings, admin (super-admin + moderation + scraped drafts + featured).
- **APIs** `app/api/*` mirror those surfaces; all vendor writes go through `resolveActor` (`lib/admin.ts`).
- **Data** comes from the Community Connector Agent API (`lib/api.ts`) + Supabase (`lib/vendor-connect.ts`).

Major subsystems, each written up in the architecture doc: **commerce** (Stripe Connect, product kinds, self-delivery, Uber Direct, Printify POD, digital delivery), **ticketing + QR check-in**, **bookings** (request-to-book + Square Appointments), **collabs + organizer toolkit**, **event sourcing** (scraped SF calendars → ranked For-you feed), **semantic personalization** (shopper taste embeddings), **the AI layer** (per-business chat agent, inbound phone agent, image→catalog capture, agent tuner, AI moderation), **push + email notifications**, **onboarding** (manual transcript, QR booth chat, `/join` interview).

## Auth
**All auth is Clerk** (WorkOS fully removed). Accounts are **Google or Apple only** — phone survives ONLY as business-ownership verification (OTP to a member's Google-listing number). Shoppers get an optional modal; `/vendor/*` is protected by `middleware.ts` + `auth()`. `vendor_profiles` links `clerk_user_id → member_id`. Native OAuth: Apple = Clerk redirect kept inside the webview; Google = native plugin → id token → `authenticateWithGoogleOneTap`. Detail + gotchas: `docs/context/auth.md`.

**Clerk API in this version:** `SignedIn`/`SignedOut` don't exist — use `<Show when="signed-in">`. `UserButton` has no `afterSignOutUrl`. Auth components must be `'use client'`; server-side `import { auth } from '@clerk/nextjs/server'`.

**Localhost gotcha:** `pk_live_` cannot auth on localhost. Use the dev instance's `pk_test_` locally; `pk_live_` only in prod.

## Commerce
**Selling is FREE (2026-08-14) — the 5% on sales IS the business model.** `commerce` lives in `FREE_CAN`; Pro ($30/mo) is now the AI agent (text + voice) + analytics, nothing to do with selling. Never re-introduce a subscription wall in front of a vendor's first sale without changing that one line in `lib/entitlements.ts` deliberately.

Stripe Connect Express per vendor, per-vendor checkout, **5% platform fee on items only, always**. Every payment creates a durable `orders` row (confirm-payment + `payment_intent.succeeded` webhook). Catalog sync (Shopify/Square) via Composio + Trigger.dev. Order lifecycle: `paid → ready → dispatched → delivered | collected | completed | refunded`.

**Two invariants — every commerce bug so far came from relaxing one:**
1. **The server derives, the client never decides** — prices from the catalog, fulfillment from the basket, fees from the vendor's rules.
2. **Whoever pays the carrier keeps the fee** — uber → platform, self → vendor, printify → vendor. The 5% is on items only.

After any commerce change, audit for the two shapes that produced silent bugs: **trusting a caller for something the server can derive**, and **an active-only product lookup used AFTER payment** (`getProductsByMember` filters `active`; post-payment code must use `getAllProductsByMember` — they paid, so whether it's still listed is irrelevant).

## ▶ START HERE — three verification actions
The gap is no longer code. Full backlog in `docs/context/pending.md`.

1. **Charge ONE real card** — validates ticketing, shop pickup, self-delivery AND digital delivery at once. ⚠️ `.env.local` holds **live** Stripe keys, so a local checkout charges for real; add `sk_test_`/`pk_test_` first to rehearse.
2. **Verify Square with a SANDBOX token** — `npx tsx scripts/square-smoke.mts <sandbox-token>`. Free, zero risk, do it **before any vendor connects**. Needs FOUR scopes: `APPOINTMENTS_READ`, `APPOINTMENTS_WRITE`, `ITEMS_READ`, `CUSTOMERS_WRITE`.
3. ~~**Connect Printify**~~ — DONE (2026-08-22). Xeno's shop is connected, 26 designs / 199 variant rows imported with per-variant galleries, and a real $4.75 postage quote came back. **`createOrder` is still unproven** — nothing has ever been sent for production, which only a real charge can do.

Also outstanding: no real card has ever been charged; the ticket email has never gone through Resend for real; the door check-in screen and the vendor Delivery/Printify cards have never been seen rendered (auth redirects a headless session); Uber Direct is blocked on account activation at Uber's end.

## Error tracking
Sentry owns errors end to end; PostHog owns product analytics + session replay (`capture_exceptions` is **false**). Full write-up: `docs/context/observability.md`.

**⚠️ THE `Http` FILTER IN `sentry.server.config.ts` IS LOAD-BEARING — deleting it takes the whole site down ~38 hours later.** Two copies of the SDK each re-wrap `server.emit` in a Proxy on every request (+2 layers/request, forever) until `RangeError: Maximum call stack size exceeded` hits every request and the container wedges. That is what happened 2026-08-13; fixed in v126.
- **A restart is not a fix** — it resets the depth to zero and buys another day and a half. If the site times out while `captain.whatslocal.ai` is fine, check this first.
- **Deduplicating the SDK does NOT work** — it's the ESM/CJS dual-package hazard in `node_modules`. Externalising `@sentry/nextjs` or `@sentry/server-utils` kills the server on boot. Both were tested; both took the site down.
- **Verify only with a BURST** — ~2,000 *concurrent* requests at the standalone build, then grep for "Maximum call stack". Serial requests give a false green.
- The DSN is baked in at BUILD time via `NEXT_PUBLIC_SENTRY_DSN`, so unsetting `SENTRY_DSN` on CapRover does not turn server Sentry off.

**PostHog session replay is ON at 100%.** Masking is a CODE concern: every surface rendering what a person SAID carries `data-private`. **A new conversation surface must be marked or it is recorded verbatim.**

## Supabase (xeno project)
Full table reference: `docs/context/database.md`. The ones you'll meet most: `vendor_profiles`, `products` (+`kind`), `orders`, `vendor_settings`, `vendor_secrets` (service-role ONLY), `vendor_events` (in-app AND scraped AND embeddings), `event_ticket_types`/`event_tickets`, `event_attendees`, `booking_requests`, `collab_invites`/`collab_rooms`/`collab_messages`, `posts`, `broadcasts`, `chat_conversations`/`chat_messages`, `shopper_taste` (service-role ONLY), `device_tokens`.

## Key Conventions
The load-bearing subset. Full list in `docs/context/conventions.md`.

- **Applying a migration: `supabase db push` HANGS — use the Management API.** The pooler URL has no password, so the CLI waits on a prompt that never arrives. The token is in the macOS Keychain:
  ```bash
  TOKEN=$(security find-generic-password -s "Supabase CLI" -w | sed 's/^go-keyring-base64://' | base64 -d)
  curl -s -X POST "https://api.supabase.com/v1/projects/xbbnvkvlrucrzobhopgh/database/query" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"query":"select 1"}'
  ```
  **Afterwards register the migration** or the CLI's history diverges: `insert into supabase_migrations.schema_migrations (version, name, statements) values ('<version>','<name>', array[$stmt$-- applied via Management API$stmt$]) on conflict (version) do nothing;`
- **Dates in the feed are CITY-LOCAL — `lib/sf-date.ts`, never `toISOString().slice(0,10)`.** UTC "today" becomes tomorrow at 5pm Pacific, which silently dropped that evening's events at exactly the hour people look for something to do. The timezone is fixed to the **city, not the viewer**.
- **Adding an event source means adding its poster hostname to `lib/image-hosts.ts` — ONE list, two consumers** (`next.config.ts` remotePatterns + `lib/image-utils.ts` display allowlist). They used to disagree, and the whole event feed rendered as text with the images sitting in the DB the entire time. Getting it half-right is silent in both directions.
- **A Composio tool slug is not a name you can guess, and a toolkit version MUST be pinned.** `SQUARE_LIST_CATALOG` and `SHOPIFY_LIST_ALL_PRODUCTS` were both invented; catalog sync could never have worked and nobody noticed because no vendor had connected. Separately, `tools.execute()` throws unless `toolkitVersions` is pinned at SDK init — so *every* `runTool` call was failing regardless. Verify a slug and its argument names with `getRawComposioToolBySlug()` before shipping it, and check response paging defaults (Square returns 25 by default, Shopify 50). `npx tsx scripts/square-verify.mts <memberId>` checks the whole chain.
- **`next/image` quality needs `images.qualities` in Next 16.** A `quality` prop not on that allowlist is **silently ignored**. Current list: `[75, 88, 90]`.
- **The model runs ONCE per new item, never per request.** Scraping is $0; each event is labelled and embedded once at ingest. The only per-request calls are reading one person's sentence. Never move labelling, embedding or extraction onto a read path.
- **Notifying a user = push + email, ALWAYS, via `lib/notify.ts`** — `notifyUser` / `notifyMemberUser` (+ `…Safe` fire-and-forget for request handlers: `void notifyMemberUserSafe(id, {...})`, never awaited on the hot path). Push alone means a vendor without the iOS app gets **nothing**. Audit any new `notifyMemberSafe` (the push-only primitive from `lib/push.ts`) for exactly that.
- **Client data fetching = SWR.** Use the shared hooks in `lib/data-hooks.ts`; **never write a raw `useEffect`+`fetch` on mount** for those datasets. **Never call `listMembers` from a client component** — route through `app/api/directory`.
- **Google Places = money. `lib/places.ts` owns the spending rules** — read the header before touching it. Search on submit never on keystroke; 24h caches; never re-buy what Text Search already returned; pass `region` or Google biases on our server's IP.
- **One search box per screen** — the top slot swaps with the tab; never stack two.
- **Picking people = `components/match/PeoplePicker.tsx`; creating a collaboration = `components/vendor/CollabComposer.tsx`.** Don't re-implement either, and never put a picker in a fixed-height scrollbox (scroll-inside-scroll).
- **A collaboration has TWO states** (`lib/collab-status.ts`): Planning → Active. Creating the event **LOCKS the lineup** (`PATCH …/members` 409s; "I'm in" becomes "Request to join").
- **Master-detail everywhere**: list of cards → open one → it becomes the title with a specific back link.
- Map = react-leaflet (Leaflet v1). Styling = Tailwind v4. Member profile pages are server components.

## Running Locally
```bash
npm run dev
```
**Everything here sorts by distance, and you are always in San Francisco.** The dev-only
pill at the bottom-left (`components/dev/DevLocationToggle.tsx`) replaces the device fix
everywhere at once — distance sort, event ranking, map pin, post location tag — so the
out-of-area view an out-of-town visitor gets is actually reachable. It overrides
`getUserPosition`, NOT the city header: a city override simulates a San Franciscan
browsing Oakland, this simulates an Oaklander. Compiled out of a production build.
**Never run two `next dev` servers from this repo at once** — they share `.next` and corrupt the Turbopack cache (intermittent 500s). Fix: kill all + `rm -rf .next` + one server.

## Deploying (marketplace → CapRover)
**⚠️ This deploy updates the LIVE App Store app.** Re-read the shipping rules and run the demo gate first.
```bash
npm run build                                   # .env.production.local MUST pin NEXT_PUBLIC_DEMO_MODE=0
PORT=3100 npx next start                        # ── GATE: curl -sI :3100/vendor must be 307 → /vendor/sign-in
tar -czf /tmp/mk.tar.gz captain-definition Dockerfile .next/standalone .next/static public
curl -sX POST https://captain.whatslocal.ai/api/v2/login -H 'Content-Type: application/json' \
  -H 'x-namespace: captain' -d '{"password":"'"$CAPROVER_PASS"'"}'          # → data.token
curl -sX POST https://captain.whatslocal.ai/api/v2/user/apps/appData/marketplace \
  -H "x-captain-auth: $TOKEN" -H 'x-namespace: captain' -F sourceFile=@/tmp/mk.tar.gz   # → "Deploy is done"
```
Then verify on prod: `/vendor` → **307 → /vendor/sign-in** + home 200. (The caprover CLI's prompt dies without a TTY — use the API.)

**Connector → Netlify:** `cd ~/Desktop/dev/community-connector-agent && netlify deploy --prod` — a **files-on-disk** deploy, so whatever is on disk ships whether or not it's committed. That's how prod once ran ~2.5 weeks ahead of git; **commit after deploying**.

**⚠️ CapRover's env API REPLACES the whole set** — read the app definition, extend it, write it back; never post a partial one.

## Testing
```bash
npm test   # vitest run
```
`tests/` holds **live integration tests** — real OpenAI + Supabase, no mocks, billable (~$0.04/run incl. one `gpt-image-1` generation). Run deliberately, not on every commit. `tests/setup-env.ts` loads `.env.local`.

Smoke scripts run against the REAL DB and clean up after themselves: `ticketing-smoke.mts`, `self-delivery-smoke.mts`, `product-kind-smoke.mts`, `digital-smoke.mts`, `printify-smoke.mts`, `bookings-smoke.mts`, `square-smoke.mts`, `voice-booking-smoke.mts`, `taste-smoke.mts`.

## Environment Variables
Full reference — every var, where to get it, what breaks without it — in `docs/context/environment.md`. The traps worth knowing here:

- **`NEXT_PUBLIC_*` is baked at BUILD time, and this repo builds LOCALLY.** The values that ship come from `.env.local` on the build machine, not CapRover. Setting a `NEXT_PUBLIC_*` on CapRover does nothing for the browser bundle.
- **Server-side vars are read from the container at runtime** (the deploy tar carries no `.env` files), so those genuinely must live on CapRover.
- **A `tr_dev_` Trigger.dev key in `.env.local` means everything you set from this machine lands in DEV**, including env-var writes. Check the environment, not just the dashboard.
- **Changing `OPENAI_EMBED_MODEL` invalidates every stored vector** — the dimension is pinned in `vector(1536)` columns. A real change means a re-embed plus a migration.
- Most integrations **no-op safely when unconfigured** (Composio, Uber, Resend, APNs, Sentry, YouTube, ad pixels) — that's deliberate, so a missing key never blocks a deploy.

## Recent Decisions
Full dated log in `docs/context/decisions.md`. The most recent, briefly:

- **2026-08-22 — the picture is part of the price.** A Printify variant's own mockups now live on its row (`products.image_urls`, default first), and the gallery, the size/colour chips and Add-to-cart share ONE selection (`components/shop/ProductBuy.tsx`) — before, choosing Navy changed the price and left a black hat on screen. Cart and saved lines are a photo then a name, both linking back (`StoredProduct.image`/`productId`, both optional, both degrading to plain text). **Quick add is gone from every remaining surface** — member profile, `/favorites`, feed post card: buying from a list means buying without the description and without the choice that decides what arrives. Vendor portal rows link to their public page only when live (a draft would 404). The storefront is the eight xen0 products; Printify reports all 26 as `visible`, so the other 18 were deactivated here and sit in the vendor's drafts.
- **2026-08-14 — selling went free, and the Square path turned out to be broken.** `commerce` moved into `FREE_CAN`: a subscription in front of a vendor's first sale taxes supply in a supply-constrained market, and 5% of sales they make beats $30/mo they won't pay. Pro is now the AI agent. Fixing the launch path found four dead things — Composio's retired `initiate()` (Square connect), two invented tool slugs (catalog sync), an unpinned toolkit version (every `runTool`), and `SQUARE_CREATE_ORDER` missing its required `location_id`. Square Appointments now borrows the catalog OAuth token instead of demanding a second pasted one. Photo scanning (`/api/ai/extract` + `/api/ai/detect-products`) is metered per plan — it had only an in-process 20/min limit, which resets every deploy.
- **2026-08-13 — maps, directions, saved businesses, event filters.** All seven Leaflet maps now share `components/map/BaseTiles` on **mapbox/light-v11** (the token was already baked into prod; five maps were never wired to it). `lib/directions.ts` + `DirectionsButton` give the app its first working "take me there" — profile, event page, feed card, shop card; **href is always the Google URL** with iPhones intercepting to Apple Maps, and always `target="_blank"` because the iOS shell allows `*.apple.com` navigation. **Saved businesses are real** (`saved_members`, migration `20260813120000` applied + registered) — the profile's Save was local `useState`. Events: For you gained filters + stars, Map is a third toggle, and the events feed now ships real lat/lng so the map stops placing pins on neighbourhood centroids. Full write-up in CHANGELOG.
- **2026-08-13 — home tabs + posting is vendors-only.** Tabs are `Events · Shops · Products` (Feed hidden not deleted, still at `/?tab=feed`; the marketplace moved from a hidden basket icon to its own tab via `components/shop/Marketplace.tsx`, shared with `/shop`). Events defaults to the calendar. `lib/hidden-members.ts` curates members out of every public listing AND the events feed (Xeno + the reviewer demo), filtered in SQL so hidden rows can't shrink the feed. The Shops tab requires a photo (`hasMemberImage`, the same list `MemberCard` draws). The nav `+` is vendor-only (`useMyMemberId`) and **`/share` bounces server-side** — bare = vendors, `?business=`/`?event=` = any signed-in person, since the memories walls exist to gather what the crowd posted.
- **2026-08-13 — this file was split.** It had grown to 205KB; the detail now lives in `docs/context/` (see the table at the top) and CLAUDE.md keeps only what causes damage if unread.
- **2026-08-13 — Sentry `Http` filter (v126).** See Error tracking above; this took prod down for real.
- **2026-08-13 — community feed seeding spec** (`features/community-feed-seeding.md`). Whatever is in the feed teaches people what the feed is for: stakes over logistics, auto content is filler that retreats, house accounts never post as a person, ranking is stakes × proximity decay, auto items live in their own table so a retention sweep can't reach a user's post. Phase 1 needs no scrapers.
- **2026-08-11 — semantic personalisation shipped.** Shopper taste embeddings rank the events feed; similarity computed in SQL (never in Node), the profile is an editable paragraph the person can read and delete, works signed-out on a `device:<uuid>`, and a search stays one-off unless they tap "Remember this". No vector index on purpose.
- **2026-08-11 — AI moderation** (`lib/ai-moderation.ts`): proactive text+image screening on the write path, free safety pass on 100% of writes, **fails OPEN**, every non-allow logged with scores. Videos are unscreened.
- **2026-08-11 — iOS crash-and-reload was WKWebView OOM**, driven by eager-loading 60 full-width posters. Levers documented at `PAGE` in `PersonalizedEvents.tsx`; `quality` is NOT a lever.
- **2026-08-10 — commerce week**: ticketing + QR check-in, self-delivery, product kinds, digital delivery, Printify POD, request-to-book, Square Appointments, "You're on the lineup", and collab invites moved from push-only to push+email.
- **2026-08-04 — scraped events went live**: 800 harvested SF events in `vendor_events`, personalised For-you feed, nightly Trigger.dev sweep. Kill switch: `npx tsx scripts/publish-events.ts --hide`.

## Changelog
See [CHANGELOG.md](./CHANGELOG.md) for history.
