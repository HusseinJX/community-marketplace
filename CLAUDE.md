@AGENTS.md

# Community Marketplace

## What This Is
A Next.js 16 (App Router) community marketplace that lets users browse local members, makers, and events. Two separate auth layers: Clerk for shoppers, WorkOS for vendors.

## Architecture
- `app/layout.tsx` — root layout with `ClerkProvider` + `StoreProvider`, sticky nav with `AuthNav`, shared header/footer
- `app/page.tsx` — member browse/map page (main landing)
- `app/members/` — member profile pages (server components; `ShopSection` is the only client component)
- `app/events/` — events listing
- `app/favorites/` — saved products page
- `app/cart/` — cart page
- `app/vendor/` — vendor portal (WorkOS-protected, separate from shopper app)
  - `app/vendor/layout.tsx` — vendor nav with email + sign-out; redirects unauthenticated to `/vendor/sign-in`
  - `app/vendor/page.tsx` — vendor dashboard (Products / Orders / Payments cards)
  - `app/vendor/sign-in/page.tsx` — redirects to WorkOS AuthKit hosted UI
  - `app/vendor/auth/callback/route.ts` — WorkOS OAuth callback handler
  - `app/vendor/setup/` — claim flow: `MemberSearch.tsx` (find your business) → `VerifyOwnership.tsx` (prove ownership via phone / website email / Instagram / Gemini fallback)
  - `app/api/vendor/verify/route.ts` — **thin proxy** to connector-agent `/verify` (the verification engine lives there as single source of truth) + persists result to Supabase `vendor_profiles`
  - `app/api/vendor/profile/route.ts` — get/set vendor profile linking (workos_user_id → member_id)
- `components/auth-nav.tsx` — `'use client'` Clerk component with `Show`/`SignInButton`/`UserButton` + favorites/cart nav icons
- `components/ShopSection.tsx` — `'use client'` component for cart/favorites buttons on vendor profiles; receives product data as props from the server component
- `components/` — shared UI components
- `lib/store.tsx` — cart + favorites context backed by localStorage; tracks `StoredProduct` (`id`, `name`, `memberId`, `memberName`, `price?` in cents)
- `lib/stripe-server.ts` — server-side Stripe singleton + `calculateFees()` (5% platform fee)
- `lib/vendor-connect.ts` — Supabase helpers: `getVendorConnectAccount`, `setVendorConnectAccount`, `updateVendorConnectStatus`, `getProductsByMember`, `getVendorProfile`, `setVendorProfile` (with verification fields), `SupabaseProduct` type
- `lib/api.ts` — Community Connector Agent API helpers; uses `next: { revalidate: 60 }` caching
- `proxy.ts` — split middleware: `/vendor/*` → WorkOS `authkitProxy`; all other routes → `clerkMiddleware`
- `app/checkout/` — checkout page (Stripe Payment Element, grouped by vendor) + success page
- `app/api/checkout/` — `create-payment-intent` and `confirm-payment` route handlers
- `app/api/products/[memberId]/` — returns active products for a member from Supabase
- `app/api/stripe-connect/` — `create-account`, `account-status/[memberId]`, `create-account-link` route handlers
- `app/api/stripe-webhook/` — handles `account.updated` from Stripe

## Auth Architecture
- **Shoppers** → Clerk. Modal sign-in (Gmail/social). All shopper routes remain public; sign-in is optional.
- **Vendors** → WorkOS AuthKit. Separate portal at `/vendor/*`. Fully protected — unauthenticated requests redirect to `/vendor/sign-in` → WorkOS hosted UI → callback at `/vendor/auth/callback`.
- The two systems never overlap. `proxy.ts` routes by path prefix.
- WorkOS session uses `withAuth()` server-side; session is cookie-backed (`WORKOS_COOKIE_PASSWORD`).

## Key Conventions
- Data comes from Community Connector Agent API (`NEXT_PUBLIC_API_BASE`)
- Map uses react-leaflet (Leaflet v1)
- Styling via Tailwind v4
- **Clerk API differences in this version:** `SignedIn`/`SignedOut` don't exist — use `<Show when="signed-in">` / `<Show when="signed-out">` from `@clerk/nextjs`. `UserButton` has no `afterSignOutUrl` prop. Auth components must be `'use client'`.
- **Member profile pages are server components** — data fetched server-side via `getMember`, `listEvents`, `getProductsByMember`. Only `ShopSection` is client-side.
- **Stripe Connect**: 5% platform fee, Express accounts. Vendor Connect IDs stored in Supabase (`xeno` project). Checkout groups cart by vendor; requires vendor to have an active Connect account. Webhook: `/api/stripe-webhook` for `account.updated`.
- **Supabase**: `xeno` project (`xbbnvkvlrucrzobhopgh.supabase.co`) — dedicated to this app. Tables: `stripe_connect_accounts`, `products`. Migrations in `supabase/migrations/`.
- **Products**: stored in Supabase `products` table (UUID id, member_id, name, description, price in cents, active). Seeded with Zahab Energy's 3 products. Fetched server-side on member profile pages.
- **Vendor ownership verification**: vendor portal claim flow at `/vendor/setup` calls `/api/vendor/verify`, which is a thin proxy to connector-agent's `/verify` endpoint. The verification engine itself lives in connector-agent (`lib/verify.js`) — single source of truth for both apps. Methods: phone (Google Places), website_email (Firecrawl), instagram (handle match), gemini (catch-all). On success, `vendor_profiles` rows get `verification_status: 'verified'` + method + evidence JSONB. Requires `CONNECTOR_ADMIN_TOKEN` env var (admin token for connector-agent's gated endpoint).

## Running Locally
```bash
npm run dev
```

## Environment Variables
- `NEXT_PUBLIC_API_BASE` — Community Connector Agent API
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — shared with zahabenergy project; both must be set in Netlify
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe keys
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` — xeno Supabase project (NOT prolocaliq)
- `WORKOS_API_KEY` / `WORKOS_CLIENT_ID` — WorkOS vendor portal auth (from workos.com dashboard)
- `WORKOS_COOKIE_PASSWORD` — session encryption secret (min 32 chars; generate with `openssl rand -base64 32`)
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI` — WorkOS OAuth callback URL (e.g. `http://localhost:3004/vendor/auth/callback` locally, production URL on Netlify)
- `CONNECTOR_ADMIN_TOKEN` — server-side only; bearer token for connector-agent's admin-gated `/verify` endpoint (must match `ADMIN_TOKEN` set in the connector-agent Netlify project)

## Recent Decisions
- Added Clerk auth (modal sign-in) — all shopper routes remain public
- Deployed to Netlify via `@netlify/plugin-nextjs` with manual `netlify deploy --prod`
- Clerk keys shared with the zahabenergy project (same Clerk account)
- Cart + favorites are product-scoped; `ShopSection` client component receives product data as props from server component parent
- Added Stripe Connect marketplace payments — vendor onboarding via Express accounts, customer checkout with Payment Element, monthly payouts
- Supabase `xeno` project is dedicated to this app only
- Member profile page converted to server component for performance; API responses cached 60s
- WorkOS chosen for vendor portal (not Clerk) — supports org management, teams, SSO, wholesale tiers as the platform matures. Clerk stays for shoppers permanently.
- Two auth systems coexist cleanly via path-based middleware split in `proxy.ts`
