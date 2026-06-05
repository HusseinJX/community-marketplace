# UI Migration: community-connect-la → community-marketplace

## Goal
Bring `community-marketplace` to visual + content parity with the Lovable-built `community-connect-la` (CCLA) prototype, while keeping all backend infrastructure (Clerk + WorkOS auth, Stripe Connect, Supabase, Community Connector Agent API) intact.

## Source App
`~/Desktop/dev/community-connect-la` — Vite + TanStack Start + shadcn/ui + Cloudflare Workers. UI-only prototype with static/mocked data. Not usable as a base because it has zero backend.

## Strategy
Port the CCLA design language into the Next.js marketplace component by component. Adopt the same shadcn/ui primitives, theme tokens, and content shapes; reuse Unsplash photos and demo member/event data; preserve all real backend wiring.

## Dependencies Added
- `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`
- `@radix-ui/react-slot`, `@radix-ui/react-label`, `@radix-ui/react-separator`
- `lucide-react` (1.16) — icon library

## Design Tokens (ported from CCLA styles.css)
Full Tailwind v4 `@theme inline` block in `app/globals.css`:
- Stone palette (`50` → `900`), indigo (`50` / `100` / `600` / `700`)
- Type-badge palettes: blue, violet, emerald, pink, orange, red-500
- CSS-variable shadcn tokens: `--background`, `--foreground`, `--card`, `--primary`, `--ring`, `--radius`, etc.
- `--shadow-soft`, `--shadow-lift`
- Inter font (Google Fonts)
- `tw-animate-css` keyframes: `message-in`, `typing-bounce`, `float-soft`, `shimmer-fill`

Notes:
- Google Fonts `@import url(...)` must be the first import in `globals.css`.
- `tw-animate-css` doesn't resolve as a bare specifier under Next.js + Turbopack; imported via relative `../node_modules/tw-animate-css/dist/tw-animate.css`.

## CSS Utilities (`app/globals.css`)
```css
.section-label   /* uppercase tiny header */
.card-soft       /* white card, stone-200 border, soft shadow */
.card-hover      /* lift on hover */
```

## Shadcn Setup
- `components.json` (rsc: true, baseColor: stone, aliases match `@/*`)
- `lib/utils.ts` exports `cn(...)`
- Starter primitives in `components/ui/`: `button`, `card`, `badge`, `input`, `label`, `separator`

## Page-by-Page Changes

### Layout & Chrome
| File | Change |
|------|--------|
| `app/globals.css` | Full CCLA theme: stone+indigo palettes, type palettes, shadow tokens, Inter, tw-animate |
| `app/layout.tsx` | "The Collective" branding, 3-column footer |
| `components/auth-nav.tsx` | Feed link + Favorites / Cart / User icon buttons (Shop link removed; merch lives in hero) |

### Home (`app/page.tsx`)
- Gradient hero (emerald → sky → violet) with blur orbs + dot grid
- Gradient "Community" headline
- **3 hero pills**: Merch (→ `/shop`), Travel (→ `/travel`), Support the Mission (2-part gradient pill, opens donate modal)
- **Donate modal**: $25/$50/$100 + Apple Pay / Cash App / Visa buttons (cosmetic placeholder)
- **Filter pills**: All / Vendors / Artists / Community (organizer mapped → "Community")
- **Demo members merged** into visible list: Dani Cruz, Kira Wave, South LA Mutual Aid, Casa Verde Plant Co
- Equal card heights via `auto-rows-fr`
- Client-side stale-while-revalidate cache for `listMembers`
- Resilient render when API errors (demos still show)

### Member Profile (`app/members/[id]/page.tsx`) — server component
- **21:9 image carousel hero** via `MEMBER_HERO_IMAGES` lookup; gradient fallback at same aspect
- Header: name + type badge, location, category/subcategory pills, italic vibe quote
- **Endorsement rows** (vendor-only): "Works with" (violet pills) + "Active in" (emerald pills) — data in `lib/endorsements.ts`
- **ActionBar** uses lucide icons (UserPlus / Bell / MapPin / HandHeart / MessageSquare), vendor "Visited" counter with localStorage
- **Organizer profiles**: main column is `<GroupChat>` (seeded messages, working composer); Events render in a compact sidebar card
- **Vendor / artist profiles**: Events render as compact image-left cards above ShopSection
- `ShopSection` mirrors CCLA: 2-col grid, square image, emerald price, "by {member}" caption
- Demo member IDs resolve via `getDemoMember(id)` — no API call

### Member Cards (`components/MemberCard.tsx`)
- Top image carousel (16:10, no counter) from `MEMBER_HERO_IMAGES`; gradient fallback
- Name + type badge, location, category·subcategory, line-clamp-3 blurb
- **Tag pills (max 2)** — merged from `services` / `specialties` / `menuHighlights` / `shareTypes` / `interests`

### Shop (`app/shop/page.tsx`)
- CCLA hero: dark gradient, "We ar**e** the Collective." (pink underline + faded e), Shop the drop / Lookbook buttons
- Sidebar filters: Category / Price / Availability / Color
- **ProductCard typography matches CCLA**: small uppercase category, `font-medium` name, `font-semibold` price, star + rating + reviews, color swatches
- Quick-add rounded pill on hover (no heavy block button)

### Feed (`app/events/page.tsx`)
Rebuilt as CCLA-style social feed with mixed event + vendor-post cards.
- Tabs: All / Events / Vendor Posts
- **EventFeedCard**: emerald left bar, EVENT pill, "Posted by [author]", title, date / location, description (line-clamped), image carousel, "View details →"
- **VendorPostCard**: indigo left bar, type-colored avatar with initials, name + type pill + timestamp, body, image carousel, optional product attachment with cart toggle, "View profile →"
- Seeded `DEMO_FEED` items spanning Zahab, South LA Mutual Aid, Dani Cruz, Casa Verde, with Unsplash images

### Event Detail (`app/events/[id]/page.tsx`)
- Hardcoded `DEMO_EVENTS` map for `demo-e1` … `demo-e6` so feed/profile clicks resolve to detail pages
- Falls through to API for real event IDs

### Cart (`app/cart/page.tsx`)
- **`−` / qty / `+` controls** per item; `X` remove button
- Line totals reflect price × qty; "$X.XX each" caption when qty > 1
- Subtotal header shows total item count
- Header cart badge reflects total qty (not unique products)
- Checkout payload sends `quantity: item.qty`

### Travel (`app/travel/page.tsx`) — new
Ported from CCLA `wild-earth.tsx`. Emerald/teal/amber hero, 3 pillars (Regeneration / Field learning / Wider belonging), external link.

### Mission (`app/mission/page.tsx`) — new
Ported from CCLA `mission.tsx`. Stone-900 / purple-900 / pink-800 gradient hero with radial light pools, 3 long-form paragraphs, pillar grid (Network / Users / Globe2), pink-purple gradient CTA card.

## New / Ported Modules
| File | Purpose |
|------|---------|
| `components/ActionBar.tsx` | Member profile action buttons |
| `components/EndorsementRows.tsx` | "Works with" / "Active in" pills |
| `components/GroupChat.tsx` | Mock group chat for organizer profiles |
| `components/ImageCarousel.tsx` | Ported from CCLA — supports `aspect` = video / square / wide / tall |
| `components/feed/EventFeedCard.tsx` | Feed-style event card |
| `components/feed/VendorPostCard.tsx` | Feed-style vendor post card with optional product attachment |
| `lib/utils.ts` | shadcn `cn()` |
| `lib/demo-members.ts` | 4 demo Member objects + `getDemoMember()` |
| `lib/demo-events.ts` | 6 demo `EventSuggestion` items |
| `lib/demo-feed.ts` | Mixed event + post feed items with author/product info |
| `lib/member-images.ts` | `MEMBER_HERO_IMAGES` → CCLA Unsplash hero photos per member ID |
| `lib/endorsements.ts` | "Works with" / "Active in" data per vendor ID |

## Data Migrations
- `supabase/migrations/20260518000000_add_product_images.sql` — backfills `image_url` for Zahab's 3 products with CCLA Unsplash photos (one of CCLA's original photo IDs 404s; replaced with a known-good URL).

## Perf
- `lib/api.ts` fetch `next.revalidate` bumped 60s → 300s
- Module-level `memberCache` Map in `app/page.tsx` keyed by filter params — stale-while-revalidate, no skeleton flash on back-nav
- Next Link prefetch (default) keeps member-card click → profile near-instant

## What Was NOT Changed
- Clerk + WorkOS middleware (`proxy.ts`)
- Stripe Connect API routes (`app/api/`)
- Supabase integration (`lib/vendor-connect.ts`)
- Vendor portal (`app/vendor/`)
- Map view (`components/MapView.tsx`)

## Known Gaps / Future
- Real backend data still passes through the Community Connector Agent API. When it returns no events / no members of a given type, demos fill the gap; once real data arrives, demos merge after real items (deduped by id where applicable).
- `lucide-react` v1.16 doesn't ship an `Instagram` icon — footer uses inline SVG workaround.
- Donate modal is purely cosmetic — no Stripe wiring on the donate flow.
- Shop page uses hardcoded merch data (no Supabase products yet for /shop). Cart and member-profile shop sections already use real Supabase products.
- "Travel" external link points at CCLA's placeholder Netlify URL.

## Commit
`8034607 — feat: port CCLA design system + content to community-marketplace`
