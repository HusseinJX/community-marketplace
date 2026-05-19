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
- `components/auth-nav.tsx` — `'use client'` Clerk component with `Show`/`SignInButton`/`UserButton` + favorites/cart icons
- `components/ShopSection.tsx` — client component for cart/favorites on vendor profiles
- `components/DeliveryRequestModal.tsx` — post-payment modal; collects dropoff address, quotes Uber fee, confirms delivery
- `lib/store.tsx` — cart + favorites context backed by localStorage
- `lib/stripe-server.ts` — server-side Stripe singleton + `calculateFees()` (5% platform fee)
- `lib/vendor-connect.ts` — Supabase helpers for all tables: `stripe_connect_accounts`, `products`, `orders`, `vendor_settings`, `vendor_profiles`
- `lib/uber-direct.ts` — `quoteDelivery`, `dispatchDelivery`, `verifyWebhookSignature`
- `lib/api.ts` — Connector Agent API helpers; `next: { revalidate: 60 }` caching
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

## Supabase Tables (xeno project)
| Table | Purpose |
|---|---|
| `vendor_profiles` | `clerk_user_id → member_id` + verification state |
| `stripe_connect_accounts` | `member_id → stripe_account_id` + status |
| `products` | vendor catalog; `source` (manual/shopify/square), `external_id` for Composio sync |
| `orders` | one row per payment intent; full item/fee breakdown + delivery fields |
| `vendor_settings` | per-vendor feature flags: `uber_direct_enabled`, Composio connection, pickup address overrides |

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

## Environment Variables
**Core:**
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

**Observability:**
- `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` — same PostHog project as connector-agent so visitor + onboarding events stitch into one funnel

## Recent Decisions
- **WorkOS fully removed** — all auth consolidated to Clerk. Simpler ops, one dashboard, one set of keys. Vendor portal uses the same Clerk instance as shoppers, differentiated by portal path (`/vendor/*`) not by auth provider.
- Commerce layer shipped in 3 phases: orders (Phase 1) → Composio catalog sync (Phase 2) → Uber Direct delivery (Phase 3)
- Claim flow is self-serve: unclaimed profile banner → `/claim/[memberId]` multi-step → proxy to connector-agent verify + claim-profile — no manual admin intervention needed
- Vendor orders dashboard auto-refreshes every 30s; Uber dispatch triggered by vendor "Mark Ready" button
- Supabase `xeno` project is dedicated to this app only (not prolocaliq)
