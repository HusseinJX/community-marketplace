@AGENTS.md

# Community Marketplace

## What This Is
A Next.js 16 (App Router) community marketplace that lets users browse local members, makers, and events. Uses Clerk for authentication.

## Architecture
- `app/layout.tsx` — root layout with `ClerkProvider` + `StoreProvider`, sticky nav with `AuthNav`, shared header/footer
- `app/page.tsx` — member browse/map page (main landing)
- `app/members/` — member profile pages
- `app/events/` — events listing
- `app/favorites/` — saved products page
- `app/cart/` — cart page
- `components/auth-nav.tsx` — `'use client'` component with Clerk `Show`/`SignInButton`/`UserButton` + favorites/cart nav icons
- `components/` — shared UI components
- `lib/store.tsx` — cart + favorites context backed by localStorage; tracks `StoredProduct` (`id`, `name`, `memberId`, `memberName`)
- `lib/` — utilities/data fetching
- `proxy.ts` — Clerk proxy (Next.js 16 renamed `middleware.ts` → `proxy.ts`); all routes public by default

## Key Conventions
- Data comes from Community Connector Agent API (`NEXT_PUBLIC_API_BASE`)
- Map uses react-leaflet (Leaflet v1)
- Styling via Tailwind v4
- Auth via Clerk — `ClerkProvider` wraps the entire app in `layout.tsx`; sign-in opens as a modal
- **Clerk API differences in this version:** `SignedIn`/`SignedOut` don't exist — use `<Show when="signed-in">` / `<Show when="signed-out">` from `@clerk/nextjs` instead. `UserButton` has no `afterSignOutUrl` prop.
- Auth components must live in a `'use client'` file — `Show` uses `useAuth()` internally and can't be used directly in server components

## Running Locally
```bash
npm run dev
```

## Recent Decisions
- Added Clerk auth (modal sign-in) — nav shows "Sign in" button for guests, `UserButton` avatar for signed-in users; all routes remain public
- Deployed to Netlify via `@netlify/plugin-nextjs` with manual `netlify deploy --prod`
- Clerk keys shared with the zahabenergy project (same Clerk account); must also be set as Netlify env vars for production
- Cart + favorites are product-scoped (not member-scoped) — buttons live in the "Shop & Products" section of vendor profiles; product data (`p.products`, `p.featuredProduct`) not yet populated in the API but the UI is ready
