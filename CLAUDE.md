@AGENTS.md

# Community Marketplace

## What This Is
A Next.js 16 (App Router) community marketplace that lets users browse local members, makers, and events. Uses Clerk for authentication.

## Architecture
- `app/layout.tsx` — root layout with `ClerkProvider`, sticky nav with `SignInButton`/`UserButton`, shared header/footer
- `app/page.tsx` — member browse/map page (main landing)
- `app/members/` — member profile pages
- `app/events/` — events listing
- `components/` — shared UI components
- `lib/` — utilities/data fetching
- `middleware.ts` — Clerk middleware; all routes public by default

## Key Conventions
- Data comes from Community Connector Agent API (`NEXT_PUBLIC_API_BASE`)
- Map uses react-leaflet (Leaflet v1)
- Styling via Tailwind v4
- Auth via Clerk — `ClerkProvider` wraps the entire app in `layout.tsx`; sign-in opens as a modal

## Running Locally
```bash
npm run dev
```

## Recent Decisions
- Added Clerk auth (modal sign-in) — nav shows "Sign in" button for guests, `UserButton` avatar for signed-in users; all routes remain public
- Deployed to Netlify via `@netlify/plugin-nextjs` with manual `netlify deploy --prod`
