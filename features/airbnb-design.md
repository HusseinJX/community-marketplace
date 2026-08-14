# Airbnb-ification — session log (2026-08-13)

What actually shipped in this session, and what is still outstanding from the
plan in [`airbnb-design-system.md`](./airbnb-design-system.md).

**Nothing here is deployed.** No build, no demo gate, no CapRover push.

54 files: 39 modified, 15 new.

---

## 1 · Tokens — `app/globals.css`

- **Coral is THE accent.** `--color-coral-50…800`; `--primary` and `--ring`
  moved off indigo. The app had been running three accents in parallel (indigo
  as `--primary`, violet through onboarding, stone-900 on buttons) plus
  emerald/amber/rose doing semantic work. Indigo tokens are kept and marked
  legacy so nothing broke; new work uses coral.
- **Scales:** radius (`--r-xs…full`), spacing (8px grid), elevation
  (`--shadow-soft/lift/float/overlay`), motion (`--ease`, `--dur`).
- **Type scale** `.t-hero … .t-fine` — 8 steps that set size, weight, leading
  and tracking together, replacing accumulated one-offs (`text-[11px]`,
  `text-[13px]`, `text-[15px]`) chosen per component.
- **Utilities:** `.listing`, `.card-media`, `.hover-reveal`, `.is-linked`,
  `.pointer-only`.
- **`--hdr-1/2/3`** — the header ramp, defined once so two stacked elements can
  each paint their own segment and meet without a seam.
- **`--top-nav`** raised to 5rem and now read by every sticky offset in the app.

## 2 · Cards and index layouts

- **`MemberCard` rewritten.** Text moved from a scrim ON the photo to below it;
  square crop; save moved top-left → top-right; distance beside the name.
- **`lib/business-hours.ts`** (new) — parses free-text opening hours into
  "Open until 8pm". Returns `null` on any doubt and renders nothing for it.
  ⚠️ Currently matches **zero** rows in the SF data.
- **`ImageCarousel`** — arrows on hover only, hidden on touch, hidden at each
  end instead of looping.
- **Saves** — `SaveBusinessButton` + `SaveEventButton` went bookmark/star →
  **heart**, amber → coral, no backdrop plate.
- **`DirectionsButton`** — the on-card variant demoted from a filled blue chip
  to a quiet underlined link. The profile pill keeps the Maps blue.
- **Rails** gained an expand affordance and pointer-only scroll arrows
  (`RailHeader`, shared by Shops and Events).

## 3 · The expanded category (Shops **and** Events)

Generalised rather than duplicated — `split-types.ts` defines one `MapPoint`,
and each surface supplies an adapter (`lib/map-adapters.ts`).

- **`CategorySplit`** — equal-width list/map on desktop, two-way hover pairing.
- **`SplitMapInner`** — category-emoji pins, fully interactive (wheel/box/
  double-click/pinch zoom).
- **`MobileMapSheet`** — full-screen map with a draggable sheet, three snap
  points, map-gesture-hides-sheet, tap-a-pin-shows-its-card.
- Both Shops categories and Events themes expand identically.

## 4 · Navbar

- **`AppHeader`** (new) — owns the conditional bottom rule.
- **`TopNav`** — wordmark left at 17px, logo 36px, city beside it on desktop /
  right-aligned on mobile, ghost "Join as a vendor", 22/22 padding when
  collapsed and 32/12 when expanded (**total height fixed at 80px**).
- **Collapsing header** (`lib/home-header.ts`) — on scroll the city + search
  fold away and the search morphs into a centred pill in the wordmark row;
  tapping it re-expands in place without scrolling. The tab switch folds on
  desktop only.
- **Header order** is now city → search → tabs.
- **`AccountMenu`** — hamburger-capsule dropdown replaced by a plain profile
  circle linking to `/shopper`. Desktop only.
- **`HeaderMenu`** (new) — three-line button left of the profile circle: Cart,
  Saved, Messages. Desktop only.
- **`BottomNav`** — mobile only, labelled, five tabs (Explore · Saved · Cart ·
  Tickets · Profile).
- Theme toggle removed from the header.

## 5 · Business profile — `app/members/[id]`

- **`PhotoMosaic`** (new) — 1 + 4 mosaic on desktop, carousel on mobile,
  `Show all N photos`, full-screen lightbox with arrow-key nav.
- **`SocialIcons`** (new) — real brand marks replacing 📸 🎵 ☁️ 💼 emoji.
- Sticky sidebar on desktop; title on the type scale; one facts line.
- **`ActionBar`** — was seven controls in five colours; now exactly one filled
  button (Book → Inquire → Directions, by what the business can do) with
  everything else a quiet outlined pill.

## 6 · Bugs found and fixed along the way

- **FilterSidebar was clipped** — `backdrop-filter` on the sticky search band
  makes it the containing block for `fixed` children, so `inset-y-0` meant "the
  60px header". Portalled to `<body>`; **`QrScanButton` had the identical bug.**
- **App banner never stayed dismissed** — plain `useState`, so the X worked
  until reload. Now persisted, no expiry.
- **Split map couldn't zoom** — Leaflet interaction defaults are dropped once
  you pass interaction props; stated explicitly.
- **Sticky day heading was overlapped** — it sat at `z-10`, the same z as the
  card internals, so DOM order won. Now `z-[15]`, between cards and the header.
- **Back buttons removed** across 18 files (swipe-back is wired in the iOS
  shell). Wizard-style backs deliberately kept — see below.
- A Tailwind arbitrary media variant emitted **invalid CSS that failed the
  entire stylesheet**; and pasting the offending class into a comment
  regenerated it, because Tailwind scans the CSS file for class names.

---

## Deliberately NOT done

- **`JoinFlow`'s "Back to menu"** and **`CategorySplit`'s "All shops"** kept:
  they change in-page state, not history, so a swipe would exit the flow.
- The `hidden lg:grid` pattern avoided in the split view — it mounts both
  branches, which meant 50 `next/image` elements for 25 businesses and two
  Leaflet maps. Branched in JS via `lib/use-media-query.ts`.

---

## REMAINING

### Onboarding — untouched, the largest piece
Nothing in `app/join/`, `app/onboard/` or `components/join/` was modified.
Still to build:
- Three named phases with a full-bleed intro screen each
- Fixed bottom progress bar with Back/Next (replacing "Step 1 of 2 · you")
- `Save & exit` on every screen
- ProLocal IQ's `LocationChoiceStep` (fixed location vs mobile/digital) ported
- AI autofill choice from the Google listing (`aiFillChoice`)
- The values step (feeds semantic matching)
- **★ The links step** — brand-colour tiles, support links (Cash App / Venmo /
  Patreon), free title+URL rows. The one genuinely new feature rather than a
  port; needs new profile fields and storage, so it is a data change too.
- Preview-your-page before publish

Two decisions needed first: does the links step ship in the same pass, and may
`JoinFlow`'s step machine be restructured or should new chrome wrap the
existing steps?

### Profile — the half not finished
- Reviews band with rating distribution bars (`EndorsementRows` is still
  hardcoded; the Google rating is fetched at onboarding and never surfaced)
- "Meet the maker" — the analogue of Airbnb's host card
- A real sticky booking card in the right rail (currently just a sticky column)

### Events tab
- Cards there still use the old treatment; only the For-you themes expand.

### Brand decisions still open
- A wordmark that survives at 24px alone
- Voice / copy pass
- **Photography rules** — the hardest unsolved problem. The events grid ingests
  scraped posters that are all text and logos, and no card design fixes that.

### Housekeeping
- Not deployed; demo gate not run.
- Z-index layers are coherent but undocumented (cards 10 · day headings 15 ·
  header band 20 · app header 30 · bottom nav 40 · filter overlay 60 · sidebar
  70 · QR 80 · lightbox 90). Two bugs this session came from shared z-indexes
  with no ordering intent; worth making these tokens.
- `HeaderMenu` is not portalled — same containing-block trap as above if it
  ever gets clipped.
