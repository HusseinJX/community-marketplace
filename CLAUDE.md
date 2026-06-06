@AGENTS.md

# Community Marketplace

## What This Is
A Next.js 16 (App Router) community marketplace that lets users browse local members, makers, and events. All auth is Clerk — shoppers use optional modal sign-in; vendors use a dedicated protected portal at `/vendor/*`.

## Architecture
- `app/layout.tsx` — root layout with `ClerkProvider` + `StoreProvider`, sticky nav with `AuthNav`, shared header/footer
- `app/page.tsx` — member browse/map page (main landing)
- `app/members/[id]/` — member profile pages (server components); shows amber "Claim this business" banner when `member.status === 'unclaimed'`
- `app/claim/[memberId]/` — self-serve claim flow (multi-step client component): sign in → pick verification method → verify → success → redirect to `/vendor/setup`
- `app/events/` — events listing
- `app/favorites/` — saved products page
- `app/cart/` — cart page
- `app/checkout/` — checkout page (Stripe Payment Element, grouped by vendor); shows `DeliveryRequestModal` after each payment
- `app/vendor/` — vendor portal (Clerk-protected)
  - `app/vendor/layout.tsx` — vendor nav with email + Clerk `<SignOutButton>`; `auth()` redirects unauthenticated to `/vendor/sign-in`
  - `app/vendor/page.tsx` — vendor dashboard (Products / Orders / Payments cards; real order count from Supabase)
  - `app/vendor/sign-in/page.tsx` — embedded Clerk `<SignIn />` component
  - `app/vendor/setup/` — profile linking: `MemberSearch.tsx` → `VerifyOwnership.tsx`
  - `app/vendor/orders/` — real order list with status badges, auto-refresh every 30s, Mark Ready / Confirm Delivered, Uber tracking CTA
  - `app/vendor/integrations/` — connect Shopify/Square via Composio Magic Link; manual sync trigger
- `app/api/vendor/` — vendor API routes (all Clerk-authed via `auth()`)
  - `orders/` — GET (list vendor's orders) + PATCH (update status)
  - `integrations/` — GET vendor_settings (Composio connection state)
  - `profile/` — POST link clerk_user_id → member_id
  - `verify/` — thin proxy to connector-agent `/verify`
- `app/api/claim/` — POST proxy: Clerk auth → connector `/verify` → connector `/claim-profile` (CONNECTOR_ADMIN_TOKEN stays server-side)
- `app/api/checkout/` — `create-payment-intent` (stores price + fee breakdown in PI metadata) and `confirm-payment` (persists order to Supabase, idempotent)
- `app/api/stripe-connect/` — `create-account`, `account-status/[memberId]`, `create-account-link`
- `app/api/stripe-webhook/` — handles `account.updated`, `payment_intent.succeeded` (durability path), `charge.refunded`; fires Shopify order push-back for Composio vendors
- `app/api/uber/` — `quote/`, `save-delivery/`, `dispatch/`, `webhook/` (Uber Direct delivery lifecycle)
- `app/api/chat/[memberId]/` — POST, **streaming** per-business customer-service assistant (OpenAI). Tool loop: `capture_lead`, `check_order_status`. Returns `X-Conversation-Id` header; persists transcripts.
- `app/api/vendor/assistant/` — Clerk-authed GET (settings + knowledge + leads) / POST (`config` | `add_knowledge` | `delete_knowledge`)
- `app/vendor/assistant/` — vendor config page: enable/disable, tone, custom FAQs, captured-leads inbox
- `app/vendor/resources/` — small-business **resources hub**: searchable/filterable catalog cards, a "Recommended for you" rail (rule-based, driven by `buildBusinessContext`), and a grounded chat guide (`components/resources/*`). Catalog is a static file (`lib/resources.ts`); no DB.
- `app/api/vendor/resources/chat/` — Clerk-authed **streaming** resource guide (OpenAI). Single tool `suggest_resources(ids[])` → emitted inline as ` RESOURCES:[...] ` markers the client parses into cards.
- `app/vendor/qr/` — **QR code** generator. Tier 0 (no AI): `lib/qr.ts` (pure `qrcode`) + `components/qr/BasicQr.tsx`, client-side PNG/SVG, encodes `…/members/{id}`. Tier 1 (AI-stylized, **flag `NEXT_PUBLIC_QR_AI=1`, off by default**): `app/api/vendor/qr/stylize/` (gpt-image-1 background → real QR composited via `lib/qr-compose.ts`/sharp → Supabase upload) + `components/qr/AiQr.tsx` (only mounted when flag on). Tier 2 (AI poster) still NOT built. Tiers share no code and the AI tiers import sharp/gpt-image-1 that `lib/qr.ts`/`BasicQr` never touch — so basic is always standalone, blockable, revertible.
- `components/QrScanButton.tsx` — marketplace QR scanner (independent; `@zxing/browser`) beside the home search bar; routes a scanned `/members/{id}` code in-app. **Camera needs HTTPS or localhost.**
- `components/AskAssistant.tsx` — floating "Ask <Business>" streaming chat widget; auto-rendered on `vendor`/`artist`/`organizer` profiles
- `lib/openai.ts` — server-side OpenAI singleton + model constants (`CHAT_MODEL`/`VISION_MODEL`/`IMAGE_MODEL`)
- `lib/business-context.ts` — `buildBusinessContext(memberId)` (stitches profile + products + events + settings + owner FAQs into a prompt blob) + `buildSystemPrompt()`
- `lib/storage.ts` — Supabase Storage `uploadImage()` helper (image capture; bucket `marketplace-media`)
- `lib/admin.ts` — `isAdmin()` (env `ADMIN_CLERK_USER_IDS` allowlist) + `resolveActor(memberId)` — resolves which member a writer may act on (own member, or any member if admin). Gates all catalog writes.
- `app/api/products/[memberId]/` — now GET (public; `?include_drafts=1` for owner/admin) + POST/PATCH/DELETE. Drafts = `active=false`; approve = flip to `true`. `source`: manual | ai_menu | ai_counter
- `app/api/events/[memberId]/` — same shape for `vendor_events` (self-serve events with posters)
- `app/api/upload/` — multipart image upload → Supabase Storage (authed via `resolveActor`)
- `app/api/ai/extract/` — OpenAI vision, structured-output extraction; `mode: products` (menu → product drafts) | `events` (flyer → event drafts, keeps poster)
- `app/api/ai/detect-products/` — counter/shelf photo → vision bounding boxes → `sharp` crop → `gpt-image-1` refine → upload → draft products (experimental; falls back to raw crop)
- `app/vendor/products/` + `app/vendor/events/` — CRUD managers with draft-approval queue; admins can target any member via `?memberId=`
- `components/ImageCaptureUploader.tsx` — shared photo→draft review/publish flow (Scan menu / Scan counter / Scan flyer)
- `app/sitemap.ts` / `app/robots.ts` — dynamic SEO files (paginated member loop + indexable filtering)
- `app/category/` — category hub (`page.tsx` index) + `[slug]/page.tsx` landing (static params from taxonomy)
- `app/city/` — place hub (`page.tsx` index) + `[slug]/page.tsx` landing (params derived from live data)
- `public/llms.txt` — static AI-crawler manifest
- `components/auth-nav.tsx` — `'use client'` Clerk component with `Show`/`SignInButton`/`UserButton` + favorites/cart icons
- `components/ShopSection.tsx` — client component for cart/favorites on vendor profiles
- `components/DeliveryRequestModal.tsx` — post-payment modal; collects dropoff address, quotes Uber fee, confirms delivery
- `lib/store.tsx` — cart + favorites context backed by localStorage
- `lib/stripe-server.ts` — server-side Stripe singleton + `calculateFees()` (5% platform fee)
- `lib/vendor-connect.ts` — Supabase helpers for all tables: `stripe_connect_accounts`, `products`, `orders`, `vendor_settings`, `vendor_profiles`
- `lib/uber-direct.ts` — `quoteDelivery`, `dispatchDelivery`, `verifyWebhookSignature`
- `lib/api.ts` — Connector Agent API helpers; `next: { revalidate: 60 }` caching
- `lib/seo.ts` — SEO helpers: `SITE_URL`/`SITE_NAME`, `isIndexable()`, `memberDescription()`, `socialUrls()`, `resolveHeroImages()`, `lastActiveMs()`
- `lib/landing.ts` — landing-page data: `slugify()`, `fetchAllMembers()` (cursor loop, capped 1000), `CATEGORIES` (from taxonomy), `citiesFrom()` (derived, drops single-listing cities)
- `components/JsonLd.tsx` — `MemberJsonLd` (LocalBusiness/Organization) + `CollectionJsonLd` (CollectionPage/ItemList)
- `middleware.ts` — single `clerkMiddleware` with `createRouteMatcher`; protects `/vendor/*` except `/vendor/sign-in`

## Auth Architecture
**All auth is Clerk.** WorkOS has been fully removed.

- **Shoppers** — optional Clerk modal sign-in (Gmail/social). All browse routes remain public. `AuthNav` shows `UserButton` when signed in.
- **Vendors** — same Clerk account, protected portal at `/vendor/*`. Middleware uses `createRouteMatcher(['/vendor((?!/sign-in).*)'])` + `auth.protect()`. Server components use `auth()` from `@clerk/nextjs/server`; layout uses `<SignOutButton>` client component for sign-out.
- One middleware file (`middleware.ts`), one auth system, zero WorkOS dependencies.
- `vendor_profiles` table links `clerk_user_id` → `member_id`. Column was renamed from `workos_user_id` in migration `20260518130000`.

## Commerce Layer (Phases 1–3)

**Payments (Stripe Connect):** Vendors get Express accounts. Buyers checkout per-vendor. 5% platform fee via `application_fee_amount` + `transfer_data.destination`. Every payment creates a durable `orders` row in Supabase (via `confirm-payment` + `payment_intent.succeeded` webhook durability path).

**Catalog sync (Composio):** Vendors connect Shopify or Square via OAuth Magic Link in `/vendor/integrations`. Products sync into Supabase `products` table with `source` + `external_id`. Daily 3am Trigger.dev job in connector-agent keeps catalogs fresh. Completed orders push back to Shopify as draft orders for inventory accuracy.

**Delivery (Uber Direct):** After payment, buyer sees `DeliveryRequestModal` — enters address, gets fee quote, confirms. Quote ID + address saved on order. When vendor clicks "Ready — Dispatch Uber" in dashboard, `POST /api/uber/dispatch` fires. Uber webhooks update order status and SMS buyer via connector-agent's `sms-send` function.

**Order status lifecycle:** `paid → ready → dispatched → delivered | refunded`

## Pending / TODO
- **AI features setup before they work** (only `OPENAI_API_KEY` + a DB push needed; bucket is a migration now):
  1. Set `OPENAI_API_KEY` in `.env.local` (placeholder already added). Optional: `ADMIN_CLERK_USER_IDS`, `SUPABASE_SERVICE_ROLE_KEY`.
  2. Apply migrations: `supabase link --project-ref xbbnvkvlrucrzobhopgh` then `supabase db push`. New migrations: `20260605120000` (assistant tables), `20260605140000` (vendor_events), `20260605150000` (public `marketplace-media` storage bucket + policies).
  - Roadmap: `/Users/xen/.claude/plans/eager-splashing-kazoo.md` — **Phase 1 (assistant) + Phase 2 (image→catalog capture) shipped; Phase 3 = voice receptionist** remains.
- **Set `NEXT_PUBLIC_SITE_URL=https://whatslocal.ai` in the production/deploy env** — it's only in local `.env.local`. Without it, prod canonicals/sitemap/JSON-LD fall back to the `https://whatslocal.ai` default in `lib/seo.ts` (currently correct, but make it explicit per environment).
- **Repoint `whatslocal.ai` DNS to this app** — it currently serves a different app, so none of the SEO output is publicly reachable yet.
- **(Optional) Per-member OG images** via `@vercel/og` — deferred nice-to-have for richer link previews.
- **Resources hub — populate the real catalog (`lib/resources.ts`).** v1 ships with a 5-item placeholder seed; the engineering (page, search, cards, recs, chat) is done but the *content* is the remaining value. Add real, verified SF entries (real `url`, or leave `url: null` + `searchHint` for a search-fallback link — never fabricate a link). Still to add from the original brief: legal/law clinics, accounting/bookkeeping help, energy-bill savings programs, planning & renovation/permit deals, business news/research (small business center), business directories, business plans, market research, entrepreneur support orgs (SCORE / Renaissance / MEDA), library events, certified small business (state/LBE) registration, SF Office of Small Business permits & events, small business public library. Induction / green / accessibility entries exist as placeholders and need real links/details.
- **Resources hub — improve-later (already shaped for, no rewrite):** LLM "why this fits you" blurbs; save/dismiss resources (needs a table **with anon/authenticated/service_role grants**); multi-city (`city` field); richer match signals (`tags`/`recommendFor`).

## SEO & AI Engine Optimization
- **Brand name is `WhatsLocal AI`** (set as `SITE_NAME` in `lib/seo.ts`). Header, footer, page titles, emails (`hello@whatslocal.ai`) all use it. The old "The Collective" name has been fully removed from visible UI (only `lib/endorsements.ts` "Inglewood Collective" remains — that's a real-world org, not the brand).
- **Per-page metadata:** root `app/layout.tsx` sets `metadataBase` + title template `%s | WhatsLocal AI`. Member pages export `generateMetadata()` (title, description, canonical, OG/Twitter, type-aware `robots`).
- **Indexing policy (`isIndexable()` in `lib/seo.ts`):** index real-entity types (`vendor`/`artist`/`organizer`) **with substance** — including *unclaimed* harvested listings (long-tail directory model). Noindex shoppers, influencers, and content-thin profiles. To exclude all unclaimed profiles instead, edit `isIndexable`.
- **Structured data:** indexable member pages emit `LocalBusiness`/`Organization` JSON-LD; category/city landing pages emit `CollectionPage`+`ItemList`. Only fields we actually hold are emitted (no fabricated address/hours — avoids structured-data penalties).
- **Landing pages:** `/category` + `/category/[slug]` and `/city` + `/city/[slug]` are server-rendered SEO hubs that list indexable members; linked from the footer and the sitemap. Only non-empty categories / multi-listing cities are included.
- **Sitemap/robots/llms.txt** all resolve absolute URLs from `NEXT_PUBLIC_SITE_URL`.

## Supabase Tables (xeno project)
| Table | Purpose |
|---|---|
| `vendor_profiles` | `clerk_user_id → member_id` + verification state |
| `stripe_connect_accounts` | `member_id → stripe_account_id` + status |
| `products` | vendor catalog; `source` (manual/shopify/square), `external_id` for Composio sync |
| `orders` | one row per payment intent; full item/fee breakdown + delivery fields |
| `vendor_settings` | per-vendor feature flags: `uber_direct_enabled`, Composio connection, pickup address overrides, `assistant_enabled` + `assistant_persona` |
| `business_knowledge` | owner-authored FAQs/notes fed into the AI assistant's context |
| `chat_conversations` / `chat_messages` | AI assistant transcripts (analytics + owner inbox + future RAG) |
| `chat_leads` | contacts the assistant captured via `capture_lead` |
| `vendor_events` | self-serve / AI-captured events (poster image, `active` draft flag, `source`) |

## Key Conventions
- Data comes from Community Connector Agent API (`NEXT_PUBLIC_API_BASE` / `CONNECTOR_URL`)
- Map uses react-leaflet (Leaflet v1)
- Styling via Tailwind v4
- **Clerk API in this version:** `SignedIn`/`SignedOut` don't exist — use `<Show when="signed-in">` / `<Show when="signed-out">`. `UserButton` has no `afterSignOutUrl` prop. Auth components must be `'use client'`. Server-side: `import { auth } from '@clerk/nextjs/server'`.
- **Member profile pages are server components** — only `ShopSection` and `ActionBar` are client-side.
- **Unclaimed profiles** (`member.status === 'unclaimed'`) show a claim banner. Claim flow at `/claim/[memberId]` verifies via connector-agent then calls `/claim-profile` to flip status.
- **Composio action names** (verify against docs before coding): `SHOPIFY_LIST_ALL_PRODUCTS`, `SQUARE_LIST_CATALOG`, `SHOPIFY_CREATE_ORDER`.

## Running Locally
```bash
npm run dev
```

## Testing
```bash
npm test   # vitest run
```
- `tests/` holds **live integration tests** — they call the **real OpenAI + Supabase** (no mocks), so `OPENAI_API_KEY` + the Supabase env must be set. They make billable OpenAI calls (incl. one `gpt-image-1` generation per run, ~$0.04) — run deliberately, not on every commit.
- Coverage: DB CRUD (`lib/vendor-connect`), assistant grounding (`buildBusinessContext` → OpenAI), vision menu extraction, `gpt-image-1` generation, counter detection + `sharp` crop, Storage upload. Synthetic test images are generated with `sharp` (`tests/helpers/synthetic.ts`).
- `tests/setup-env.ts` loads `.env.local` into `process.env`. Config: `vitest.config.ts` (node env, `@/` alias, serial).

## Environment Variables
**Core:**
- `NEXT_PUBLIC_SITE_URL` — canonical site origin (`https://whatslocal.ai`). Used by `metadataBase`, canonical tags, sitemap, robots, JSON-LD. **⚠️ The domain does not yet point at this app** (currently serving a different app); DNS will be repointed soon. Until then, sitemap/canonical URLs reference an origin that isn't live yet.
- `NEXT_PUBLIC_API_BASE` — Community Connector Agent base URL (e.g. `http://localhost:8888`)
- `CONNECTOR_URL` — server-side connector agent URL (same value, not public)
- `CONNECTOR_ADMIN_TOKEN` — bearer token matching `ADMIN_TOKEN` in connector-agent (for `/verify`, `/claim-profile`, `/composio-*`, `/sms-send`)

**Clerk:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — shared with zahabenergy project

**Stripe:**
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`

**Supabase:**
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` — xeno project

**Uber Direct:**
- `UBER_DIRECT_CUSTOMER_ID` / `UBER_DIRECT_SERVER_TOKEN` / `UBER_DIRECT_WEBHOOK_SECRET`

**Marketplace ↔ Connector:**
- `MARKETPLACE_URL` — set in connector-agent env; used by Composio callback redirect

**AI (OpenAI):**
- `OPENAI_API_KEY` — **required** for the per-business assistant (and Phase 2 vision/image gen). Not yet in `.env.local`.
- `OPENAI_CHAT_MODEL` / `OPENAI_VISION_MODEL` / `OPENAI_IMAGE_MODEL` — optional overrides (default `gpt-4o-mini` / `gpt-4o` / `gpt-image-1`)
- `SUPABASE_SERVICE_ROLE_KEY` — preferred for Supabase Storage writes; falls back to anon key
- `SUPABASE_MEDIA_BUCKET` — storage bucket name (default `marketplace-media`)
- `ADMIN_CLERK_USER_IDS` — comma-separated Clerk user IDs allowed to manage any business's catalog/events on their behalf

**Observability:**
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` — same PostHog project as connector-agent so visitor + onboarding events stitch into one funnel

## Recent Decisions
- **WorkOS fully removed** — all auth consolidated to Clerk. Simpler ops, one dashboard, one set of keys. Vendor portal uses the same Clerk instance as shoppers, differentiated by portal path (`/vendor/*`) not by auth provider.
- Commerce layer shipped in 3 phases: orders (Phase 1) → Composio catalog sync (Phase 2) → Uber Direct delivery (Phase 3)
- Claim flow is self-serve: unclaimed profile banner → `/claim/[memberId]` multi-step → proxy to connector-agent verify + claim-profile — no manual admin intervention needed
- Vendor orders dashboard auto-refreshes every 30s; Uber dispatch triggered by vendor "Mark Ready" button
- Supabase `xeno` project is dedicated to this app only (not prolocaliq)
- **SEO/AEO layer added** (Phases 1–3 of the SEO plan): per-page metadata + canonicals, type-aware JSON-LD, dynamic sitemap/robots, `llms.txt`, and `/category` + `/city` landing hubs. Indexes unclaimed-but-substantive business listings (directory model), noindexes shoppers/influencers/thin profiles.
- **Brand consolidated to `WhatsLocal AI`** across all visible UI (was mixed "The Collective" / "WhatsLocal AI"). Contact email is `hello@whatslocal.ai`.
- **Domain `whatslocal.ai` not yet pointed here** — lives on a different app; will be repointed. Deferred: per-member OG images (`@vercel/og`).
- **AI layer added (OpenAI):** Phase 1 = per-business CS chat assistant (context-stuffed RAG, streaming, `capture_lead`/`check_order_status` tools). Phase 2 = image→catalog capture (menu/flyer/counter via vision + `gpt-image-1`, approval queue, superadmin on-behalf-of). Both shipped + covered by live integration tests. **Phase 3 = voice receptionist (OpenAI Realtime + Twilio + a new reservations subsystem) is NOT built yet.**
- **Single AI provider = OpenAI** for chat, vision, and image generation (`gpt-4o-mini` / `gpt-4o` / `gpt-image-1`), kept in this Next.js app rather than the connector-agent.
- **Catalog drafts reuse `products.active`** (false = draft pending approval) rather than a new status column. Vendor write paths use the **anon key**, so all vendor tables needed explicit grants (fixed in migrations `…160000`/`…170000` after the original migrations granted only `products.SELECT`).
- **Vision routes send images to OpenAI inline (base64)**, not as Supabase storage URLs — OpenAI's downloader is slow/flaky fetching those (caught by integration tests).
- **Resources hub (v1, intentionally simple):** static SF catalog in `lib/resources.ts` (editing data = editing the file), deterministic **rule-based** recommendations (`recommendResources`, unit-tested, no API cost), grounded chat for exploration. **No migration** (stateless). Unverified resources render a "Find this program →" search link rather than a fabricated URL — never ship a made-up link. Improve-later (already shaped for, no rewrite needed): LLM "why this fits you" blurbs, save/dismiss (needs a table **with anon/authenticated/service_role grants**), more cities (`city` field), richer match signals (`tags`/`recommendFor`).
