# Airbnb-ifying WhatsLocal — design system + brand guidelines

**Status:** direction document. Nothing here is built yet.
**Thesis:** Airbnb took an ugly category (short-term rentals) and made it beautiful, and the
beauty *was* the repositioning. We are doing the same to local business listings. Their
**Homes · Experiences · Services** is our **Events · Shops · Products** — the mapping is not a
metaphor, it is the same information architecture.

---

## 0. What I actually checked

| Source | Read |
|---|---|
| Ours | `app/globals.css`, `components/TopNav.tsx`, `BottomNav.tsx`, `home/HomeTabs.tsx`, `MemberCard.tsx`, `ActionBar.tsx`, `app/members/[id]/page.tsx`, `app/join/JoinFlow.tsx`, `components/auth/*`, `live/EventsMapView.tsx` |
| ProLocal IQ | `~/Desktop/dev/monorepo-mae/prolocaliq` — `pages/business-onboarding.tsx`, `business-claim-onboarding.tsx`, `components/location-choice-step.tsx`, `business-details-form.tsx`, `social-connections.tsx`, `social-influence-setup.tsx`, `business-values-step.tsx`, `enhanced-image-selection-step.tsx`, `complete-step.tsx` |
| Airbnb | From knowledge of the DLS (Cereal, Rausch, the 2023+ refresh, the host-onboarding rewrite). Not scraped live. |

**One correction up front.** There is no Linktree and no Cash App *social link* in ProLocal IQ.
I grepped the whole client. "CashApp" appears exactly twice, both as a **Stripe payment method**
in `business-support-modal.tsx` / `support-card.tsx` ("Apple Pay, Google Pay, CashApp Pay, Amazon
Pay, Klarna, or card"). What ProLocal IQ actually has is two separate socials patterns, both
good, described in §5. The Linktree-style step you're describing is a thing we should **build**,
not port — spec in §5.3.

---

## 1. The design system gap, in one table

| Token | Airbnb | Us today | Move to |
|---|---|---|---|
| Typeface | Cereal (custom geometric sans, tight, low contrast) | Inter, from Google Fonts CDN | Keep Inter but **self-host** and tighten. Inter is the right neutral; Cereal's character comes from tracking + weight discipline, not the letterforms. |
| Type scale | Big jumps: 32/26/22/18/16/14/12, weight 600 for everything structural | `text-xl` headings, `text-[11px]`/`[13px]` one-offs scattered | Publish a 7-step scale. Ban arbitrary `text-[Npx]` outside it. |
| Brand color | Rausch `#FF385C` — used **sparingly**, mostly the logo, the price, the CTA | `--primary: indigo-600`, plus violet in `/join`, emerald, rose, amber, pink | **Pick one.** We currently have three competing accents (indigo primary, violet onboarding, stone-900 buttons). |
| Neutrals | `#222` / `#717171` / `#DDDDDD` / `#F7F7F7` — four, that's it | Full stone 50→900 ramp, all ten in use | Collapse to 4–5 semantic neutrals. |
| Radius | 12px inputs, 16px cards, **999px** pills, 32px search bar | `--radius: 1rem`, `.card-soft` overrides to 14px | One scale, no overrides. |
| Elevation | Cards are **flat** at rest, shadow on hover; modals get real elevation | `.card-soft` = hairline border, no shadow; `--shadow-lift` defined but barely used | We're already right. Keep it, add the hover lift. |
| Spacing | Strict 8px grid | Mixed (`pt-3`, `gap-x-3 gap-y-1`, `mt-1.5`, `pb-24`) | 8px grid, 4px only for icon-to-label. |
| Dark mode | Doesn't ship one | Ships one, but as a `.dark .bg-white {}` override sheet (see `globals.css:250`) and it's dev-only | Leave it. It's a documented hack and it works. Don't let the redesign drag it in. |

The single highest-leverage change is **the accent color**. Airbnb's whole visual identity is
one pink against near-black text on white. We have indigo, violet, emerald, amber, rose and pink
all load-bearing somewhere. That reads as a template, not a brand.

---

## 2. Navbar — the biggest structural difference

**Airbnb desktop header, top to bottom:**
1. Logo left · expandable search pill center · `Become a host` + globe + avatar-in-a-pill right
2. **Product switch is IN the header**, above the search: Homes / Experiences / Services with little animated icons
3. Search pill = segmented (`Where` | `Check in` | `Check out` | `Who` + magnifier). On scroll it collapses to a compact pill; clicking re-expands it into a big overlay.
4. Below the header: horizontally scrolling **category icon rail** + a `Filters` button pinned right + a `Display total before taxes` toggle.

**Airbnb mobile:** compact floating search pill at top, category rail under it, **bottom tab bar** of 5 (Explore / Wishlists / Trips / Inbox / Profile).

**Ours today:**
- `TopNav` — three equal columns: `+` (vendors only) / centered "WhatsLocal AI" wordmark / theme toggle (dev-only, so in prod the right column is *empty*).
- `HomeTabs` — search bar, then a sticky pill group (Events · Shops · Products) *below* it, then `CityHeader`, then a per-tab heading with a second segmented control (What's on / For you / Map).
- `BottomNav` — 2 items (Local, Profile), icon-only, no labels.

**What to change:**

| | Now | Airbnb-ified |
|---|---|---|
| Tab switch | Sticky pill *below* the search | Move **into the header**, above the search. It's the product switch; it outranks the query. |
| Search | `HomeSearch` / `EventSearchBar` swap per tab | One **segmented pill** that changes its fields per tab: Events → `Where · When · What`; Shops → `Where · Category`; Products → `Where · Category · Price`. Collapses on scroll. Preserves the "one search box per screen" rule in CLAUDE.md — it's still one box. |
| Categories | None on Shops/Products; `PersonalizedEvents` has topic stars | A **category icon rail** under the header on all three tabs, + a `Filters` button pinned right. This is the thing that makes Airbnb's index feel alive and we have zero of it. |
| Right slot | Empty in production | Avatar-in-a-pill menu (Airbnb's is a hamburger + avatar in one rounded capsule). Sign-in, saved, tickets, orders, "List your business". |
| `+` button | Vendor-only, left | Fold into the avatar menu as "Post". The left slot becomes breathing room, and the wordmark can go **left** where Airbnb's logo lives. |
| Bottom nav | 2 icons, unlabeled | 4–5, **with labels** (Airbnb labels every tab): Explore · Saved · Tickets · Inbox · Profile. We already have `/favorites`, `/tickets`, `/messages` built and unreachable from the tab bar. |

The events sub-toggle (What's on / For you / Map) is correct as-is — Airbnb has the same
list-vs-map switch. See §6.

---

## 3. Index page layout + the card

Airbnb's index is: category rail → dense responsive grid → cards that are **almost entirely
image**, text below.

**Our `MemberCard` diverges in one specific way and it's worth naming.** We render the name and
subtitle as white text on a frosted scrim *over* the photo (`MemberCard.tsx:101-126`). Airbnb
tried that years ago and moved away from it, because:
- white-on-photo legibility is a coin flip per image,
- the scrim eats the bottom third of the picture you paid for,
- text below the image aligns across a row; text inside it never does.

**Card spec to move to:**

```
┌─────────────────────┐
│                     │  4:3 image, radius 12px
│      [photo]     ♡  │  ♡ heart top-RIGHT (Airbnb's position; ours is top-LEFT)
│                     │  carousel dots bottom-center, arrows on hover (desktop only)
│   ● ○ ○             │
└─────────────────────┘
  Tartine Bakery    ★4.8   ← name 15px/600 + rating right-aligned, same line
  Mission · Bakery         ← 15px/400 grey
  0.4 mi away              ← 15px/400 grey
  Open until 8pm           ← 15px/600 black — the ONE bold fact (Airbnb's price line)
```

**Hover is a whole state, and we have none of it.** On Airbnb, a card at rest is completely
quiet — just image, dots, heart. Everything else appears on hover:

- **Carousel arrows fade in** (‹ ›), left/right, only on hover, only on desktop (touch devices
  swipe, so they never render). They're circular, white, semi-transparent, with a soft shadow —
  and the left arrow stays hidden on slide 1, the right on the last slide.
- The **dots** brighten from ~60% to full.
- The card lifts slightly (`--shadow-lift` is already defined in `globals.css:125` and unused).
- **In split view, hovering a card highlights its marker on the map** — the price pill flips to
  the inverse treatment (dark ground, white label) and rises above its neighbours in z-order.
  The reverse holds too: hovering a marker highlights the card in the list.

That last pairing is the thing that makes the split view feel like one surface rather than two
panes. It needs a shared hover id lifted to whatever owns both the list and the map — the split
container, not either child. Our `ImageCarousel` already takes `indicators`/`showCounter`
props, so the arrows are an addition to it, not a rewrite; and `MemberCard` passes `compact`
for rail cards, which should stay arrow-less (a 176px card inside a horizontally-scrolling rail
already fights the rail's gesture — that's noted in the component and still true).

**The bold terminal line is the other key borrowing.** Airbnb's card always ends with one bold fact
(`$248 for 2 nights`). Ours should too, per surface:
- **Shops** → `Open until 8pm` / `Closed`
- **Events** → `Fri, Aug 22 · 7pm` or `From $15` / `Free`
- **Products** → `$28`

We currently bury open/closed and price. Making it the bold terminal line is what turns a
directory into a marketplace.

Other borrowings: `Guest favourite` badge → our **Featured / verified** badge, same top-left
white pill. `Show map` floating button → §6.

---

## 4. Business profile ← Airbnb listing page

Airbnb listing page, in order: **photo mosaic** (1 large + 4 in a 2×2, `Show all photos`
button bottom-right) → title → `★4.9 · 128 reviews · Mission, San Francisco` → the split
(scrolling left column / **sticky booking card** right) → highlights → About with `Show more` →
amenities grid → **reviews** (rating bars + 2-col review cards + `Show all 128`) → map with
neighborhood copy → `Meet your host` card → Things to know.

**Ours** (`app/members/[id]/page.tsx`): back link → `ImageCarousel` 21:9 hero → h1 + type badge
→ location → category chips → vibe quote → `ActionBar` → `lg:grid-cols-3` with a 2-col main and
a sidebar.

The bones are already Airbnb's. Five concrete gaps:

1. **Hero is a 21:9 carousel; theirs is a mosaic.** The mosaic is why their listings feel
   generous — you see five photos before scrolling. We have `memberImages()` returning up to
   3+; render 1+4 on desktop, keep the carousel on mobile (which is what Airbnb does).
2. **No sticky action card.** `ActionBar` is a horizontal row under the title. Airbnb's is a
   bordered, elevated card in the right rail that follows you down the page and holds the
   money action. Ours should hold: **Message · Order · Book · Get tickets** + Directions, and
   follow. This is also the single best conversion change on the page.
3. **Reviews / comments don't exist as a section.** Airbnb gives them a full band with rating
   distribution bars. We have `EndorsementRows` (hardcoded, `ENDORSEMENTS[id]`), a memories
   wall, and Google rating fetched during onboarding but not surfaced on-profile. A real
   reviews band is the biggest missing surface on this page.
4. **`Meet your host` has no analogue** — and it's our strongest card. Airbnb's host card is
   the emotional center of the page. Ours is *Meet the maker*: face, years in the
   neighborhood, what they're known for, response time. We already have the interview
   transcript from `/join` that would write it.
5. **Socials render as emoji.** `page.tsx:270-284` builds 13 social links with `icon: "📸"`,
   `"𝕏"`, `"🎵"`, `"☁️"`. Emoji render differently on every OS and instantly read as unfinished.
   Swap for real brand marks (§5).

---

## 5. Onboarding — Airbnb + ProLocal IQ, merged

### 5.1 What each one does

**Airbnb host onboarding** (the 2023 rewrite):
- Three named phases with a **full-bleed intro screen each**: *Tell us about your place* /
  *Make it stand out* / *Finish up and publish*. Each intro is a looping video on one side and a
  large numbered list on the other. It tells you the whole shape before asking anything.
- **One question per screen.** Enormous type (32px+), enormous tap targets, tons of whitespace.
- **Progress + navigation live in a fixed bottom bar**: three thin segment bars (one per phase),
  `Back` left, `Next` right. Never a numbered stepper at the top.
- `Save & exit` on every screen. The draft persists.
- Choices are **big bordered tap-cards with an icon**, 2-up grid, border thickens on select.
- Ends with a **full preview of the listing** before publish.

**ProLocal IQ** (`business-onboarding.tsx`, 570 lines):
- Numbered step chips + a percentage progress bar **at the top**, mobile version scrolls
  horizontally (`:316-346`).
- One `<Card>` per step, each opening with a **colored circle icon** (blue/green/purple ground,
  lucide glyph), a bold question as the title, and a grey sub-line. This is the pattern you
  like, and it is genuinely Airbnb-adjacent.
- `LocationChoiceStep` (`:36-69`) is a clean two-tap-card fork — *Fixed Physical Location* vs
  *Mobile or Digital* — with `active:scale-[0.98]`, hover tint, and a decent long-form question.
  **This is the best single screen in either app.**
- The branch is real: manual skips the find-business step entirely (`:203-210`).
- `aiFillChoice: 'manual' | 'ai' | 'skip'` — offers to autofill from the Google listing.
- **`SkipForward` on the image step.** Nothing is a wall.
- `BusinessValuesStep` — pick what you stand for. We have nothing like it and it feeds
  matching.
- `CompleteStep` — a review-everything screen before submit.

**Ours** (`app/join/JoinFlow.tsx`, 744 lines, steps: `type → who → business → code2 → working
→ interview → done`):
- `max-w-md` column, `text-xl` heading, `Back to menu` link top-left, and progress is a single
  grey line of text: `Step 1 of 2 · you` (`:518-522`). No bar, no phases.
- `TYPES` picker (`:530-539`) is already the tap-card pattern — icon, title, sub, chevron. Good.
- Google-listing search + OTP-to-the-listed-number is genuinely better verification than
  anything ProLocal IQ has. Keep it exactly.
- `JoinInterview` (the voice/text interview) is our unfair advantage — Airbnb has no equivalent.
- The `done` screen sells three plans, correctly StoreKit-gated for native (`:686-710`).

### 5.2 The merged flow

Three named phases, Airbnb-style, with a fixed bottom progress bar. ProLocal's icon-circle +
question-as-title inside each screen. Our verification and interview untouched.

```
PHASE 1 — "Tell us about your business"        [intro screen: what's coming, 3 numbered lines]
  1  What are you setting up?          ← our TYPES tap-cards, enlarged
  2  Fixed location, or mobile/digital? ← port ProLocal's LocationChoiceStep verbatim
  3  Find your business on Google       ← ours, unchanged (skipped if mobile/digital)
  4  Verify you run it (OTP)            ← ours, unchanged

PHASE 2 — "Make it stand out"                  [intro screen]
  5  Photos                             ← ProLocal's outside/inside/skip, + our capture flow
  6  Autofill from your listing?         ← ProLocal's aiFillChoice: AI / manual / skip
  7  Your details                        ← prefilled, editable, never a blank form
  8  ★ Your links                        ← NEW — §5.3
  9  What you stand for                  ← ProLocal's values step; feeds semantic matching
 10  The interview                       ← ours. Nobody else has this.

PHASE 3 — "Finish up and publish"              [intro screen]
 11  Preview your page                   ← the real profile, rendered. Airbnb's best move.
 12  Pick a plan                          ← our `done` screen, StoreKit rules intact
```

Rules to enforce throughout, all copied from Airbnb:
- One question per screen. Never two.
- Progress + Back/Next in a **fixed bottom bar**, never a top stepper.
- `Save & exit` everywhere; the draft survives.
- Every optional step has a visible **Skip**.
- Never show a blank form when we can prefill and let them correct.

### 5.3 ★ The links step — this is the one to build

You described it as "the link tree and everything, adding the Cash App". That doesn't exist in
ProLocal IQ, but the two halves that inspired it do, and they're the right raw material:

- `business-details-form.tsx:711-787` — plain `@handle` inputs, each with its lucide brand icon
  as the label. Simple, fast, correct.
- `social-connections.tsx:36-85` — a grid of **brand-colored tiles** (IG = purple→pink gradient,
  FB = `bg-blue-600`, X = `bg-sky-500`, YouTube = `bg-red-600`, TikTok = `bg-black`), each with
  a description, split into `type: "intent"` (paste a handle) vs `type: "oauth"` (real connect).
- `social-influence-setup.tsx:195-237` — the **connected state**: green check, `@username`,
  follower count, a `Verified` badge, and a `Refresh` button.

Combine into one screen:

```
Where else can people find you?
Add as many as you like — they all show on your page.

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  [IG tile]   │ │  [TikTok]    │ │  [Website]   │   brand-colored, tap to add
│  Instagram   │ │  TikTok      │ │  Website     │
└──────────────┘ └──────────────┘ └──────────────┘
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  ✓ @tartine  │ │  [Cash App]  │ │  + Add link  │   connected tiles show the handle
│  12.4k       │ │  Support us  │ │              │   and turn into a filled state
└──────────────┘ └──────────────┘ └──────────────┘
```

Two things this needs that we don't have:

1. **Support links as a first-class category** — Cash App, Venmo, PayPal, Patreon, GoFundMe,
   Buy Me a Coffee. For a small local business this is the single most-requested link and
   nobody in this space does it well. It also pairs with the giving badges we already ship.
   Note: these are *external* links, not our checkout — they route around Stripe Connect
   entirely, so they must never appear where a purchasable item does. On iOS, an external
   support link for a physical/community cause is fine under 3.1.1; a link that buys *our*
   subscription is not. Keep them visually and structurally separate from Buy/Book.
2. **An "everything else" free-link row** — title + URL, reorderable. That's the Linktree part.

We already store 13 platforms (`page.tsx:270-284`), so most of the plumbing exists. What's
missing is (a) a step that asks for them, (b) support links, (c) free links, (d) real brand
icons instead of emoji.

---

## 6. Map — the split view

Airbnb: `Show map` floating pill on mobile → full-screen map with a swipeable card carousel at
the bottom. Desktop → **split view**, listings scroll left, map fixed right. Markers are
**price pills**, not pins. Hovering a card lifts its pin; clicking a pin opens a mini listing
card in a popup with photo + title + price.

Ours: `EventsMapView` is 36 lines; `WhatsOnMapInner` is 150. Map is a third icon in the events
toggle and takes the full width — no list beside it.

**When the split view appears.** Not always — Airbnb shows it when a **category is expanded**,
i.e. you've drilled from the browse index into a specific category and are now in results. The
index itself stays a full-width grid. That's exactly our shape too: Events and Shops both have
categories, and the split belongs on the *expanded category*, not the tab root. So:

- `/?tab=events` and `/?tab=shop` → full-width grid + category rail. No map.
- Tap a category → results view, **list left / map right** on desktop, `Show map` pill on mobile.
- The Map icon in the events toggle stays as the explicit full-map escape hatch.

This also resolves a tension in the current design: the map is a *third peer* of What's on /
For you right now, which makes it feel like a different feed. As a property of the expanded
category it reads as a lens on the results you already asked for.

Two uses, both yours:

**a) Expanded event/shop category** — desktop split: results list left, map right, synchronized
hover (see §3 on hover state). Marker label = the **date/price**, not a generic pin. Popup =
the `EventCard` we already have, shrunk.

**b) "Where to watch the game"** — this is the stronger product. Same split, but the map is the
hero: pins are venues showing the match, the pill reads `Sat 12pm · Arsenal v Spurs`, the popup
is the venue card with Directions and "who else is going". `/live` and `/watch-world-cup`
already exist as routes; this is the layout they've been missing. (Note the App Store 5.2.1
constraint recorded in `HomeTabs.tsx:145` — the FIFA-branded CTA is parked. The *layout* is
unaffected; just don't reintroduce the trademarked framing.)

Map styling already went to `mapbox/light-v11` via `components/map/BaseTiles` — that's
Airbnb-adjacent already and shouldn't change.

---

## 7. The login modal

Airbnb's is famously minimal: small centered sheet, `Log in or sign up` + an X, one phone/email
field, a red `Continue` button, `or` divider with hairlines, then 3–4 outlined provider buttons
with the brand mark **left-aligned inside the button** and the label centered. No illustration,
no marketing copy, no tabs.

We have `components/auth/LoginModal.tsx` + `OAuthBrandIcons.tsx` and only two providers (Google,
Apple — per the auth architecture, and phone survives only as ownership verification). That is
*already* closer to Airbnb's ideal than Airbnb is. The work here is cosmetic: sheet radius, the
hairline `or` divider, the icon-left/label-centered button treatment, and killing any copy above
the fold.

---

## 8. Brand guidelines — what needs deciding

These are the decisions I can't make for you; everything above waits on them.

1. **The accent color.** One. Airbnb has Rausch. Candidates from what's already in the code:
   indigo-600 (current `--primary`), violet-600 (the `/join` accent), or something new. My
   recommendation is a **warm** accent — indigo reads SaaS, and Airbnb's pink reads human. A
   coral/terracotta against the stone neutrals we already have would be distinctly ours and
   would not be Airbnb's pink.
2. **The wordmark.** "WhatsLocal AI" as centered text with a PNG mark (`TopNav.tsx:71`). Airbnb
   moved to a symbol that works at 24px alone. We need a mark that survives the header, the
   favicon, and the app icon without the words.
3. **Photography rules.** Airbnb's grid works because every photo obeys the same rules (natural
   light, wide, no text overlay, no logos). We ingest scraped event posters — which are *all*
   text and logos. This is the hardest unsolved problem in the whole redesign and it will
   dominate how the events grid looks. Worth its own decision.
4. **Voice.** Airbnb writes short, second-person, warm, never clever. Our code comments have
   exactly this voice already. The UI copy doesn't yet.
5. **Motion.** Airbnb: 200–300ms, ease-out, subtle. We have a good animation vocabulary in
   `globals.css:164-219` (`pick-confirm`, `check-pop`) with a `prefers-reduced-motion` guard.
   Extend that discipline rather than starting over.

---

## 9. Suggested order

Cheapest-to-most-valuable, each shippable alone:

1. **Tokens** — one accent, 5 neutrals, one radius scale, one type scale, 8px grid. Nothing
   visible changes; everything after gets easier.
2. **The card** — text below the image, heart top-right, one bold terminal fact. Biggest visual
   change for the least code, and it touches every index page at once.
3. **The header** — tabs into the nav, segmented search pill, category rail, avatar menu.
   Labeled bottom tabs.
4. **Onboarding** — three phases, bottom progress bar, the links step, the preview screen.
5. **The profile** — photo mosaic, sticky action card, reviews band, Meet the maker.
6. **Split map** — events first, then where-to-watch.

⚠️ Every one of these ships to the live App Store app on deploy. The demo gate in CLAUDE.md
applies to all of them, and steps 3–5 touch the vendor/native boundary — the plan cards on the
`/join` done screen must keep their `native` branch (`JoinFlow.tsx:686-710`).
