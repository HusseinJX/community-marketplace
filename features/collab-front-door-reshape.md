# Reshape: collaboration-for-events as the front door

**Status:** designed + partially built (Steps 1–3 "lite" done). The substantive
reshape is NOT built yet. This doc is the spec to finish it in a new session.

## The bet (why we're doing this)
The app's one wedge is **collaboration between local businesses to put on events**.
The differentiator is the **semantic matching engine** (connector Pinecone: complementary
needs↔offers, the convener that invents an event and fills roles) — nobody else matches
a coffee roaster to a muralist to a taco cart for a night market. Everything else
(directory, shopping, live, resources) is supporting cast.

**Target ICP:** event-native businesses (bars, food & bev, makers, artists, venues,
organizers) in a dense area — the ones who do events multiple times a month. NOT "all
small businesses."

**The problem being fixed:** the wedge is buried (collab lives 3 taps deep in
`/vendor/network`), and the app's front door pitches a directory ("shop all local
businesses") it can't win against Google/IG. Reshape so the app *presents* as what
we're betting on:
- **Businesses** enter at "build your next event with the right collaborators."
- **Shoppers** enter at "what's happening near you" (the time-sensitive hook, which is
  the *output* of collaborations).
- Directory/shopping stays as the **floor** everyone lands on — never the headline.

**Flywheel:** Collaborate (supply) → Event/Live (hook) → Shoppers show up (demand) →
Profiles & shop (payoff) → reason to collaborate again.

Visual mocks (Claude artifacts, reference for the target presentation):
- IA reshape (two role-aware phone screens + build plan)
- Pricing re-cut (free participate / $10 act / $30 capture)
(Links live in the chat that produced this; rebuild from this doc if lost.)

## Current state / how to resume
- Branch: **`feat/collab-rooms`** @ `4e3d755`. Tag **`pre-redesign`** = `2a544c1` (pre-session).
- **Prod (whatslocal.ai / CapRover) is rolled back to `pre-redesign`** — none of this
  work is live. Local branch keeps all commits for localhost review.
- Nothing pushed to remote. No DB migrations added this session. Fully reversible.
- Deploy new work to prod later: `./scripts/deploy-caprover.sh` from `feat/collab-rooms`
  (needs `CAPROVER_PASSWORD` from `.env.local`'s `CAPROVER_PASS`).
- **`.next` cache trap:** never run `next build` (the deploy script) while a `next dev`
  server is running — they share `.next` and corrupt Turbopack. If localhost shows stale
  content: kill dev, `rm -rf .next`, restart `npm run dev`.

### What's already built (Steps 1–3 "lite" — the cheap slice)
1. **Business dashboard hero** — `components/vendor/VendorHome.tsx`: a "Build your next
   event" CTA card (headline + Find collaborators / Host an event buttons) added above
   the dashboard. It's a *static card*, not the real matcher.
2. **Shopper home hero copy** — `components/home/HomeTabs.tsx`: swapped "Your neighborhood,
   all in one place" → "See what's happening near you — tonight & this weekend." Copy only.
3. **Collaborator count on event cards** — `app/api/events/feed/route.ts` +
   `lib/collab-network.ts` `getAcceptedLineupCounts()` (batched, no N+1) +
   `components/live/CommunityEventsLive.tsx`: a text "N teamed up" badge when >1 business.

This gestures at the idea but does NOT transform the experience. The real work is below.

---

## Build tasks (the actual reshape)

### Task A — Business home = the live matcher (highest signal)
Replace the static hero card with the **real matching engine pushing complementary
vendors**, so a business opens the dashboard and sees "here are 3 partners near you
you'd never have thought of," each with an Invite action.

- Reuse `components/match/MatchFinder.tsx`. Signature:
  `{ memberId, isAdmin, selected: Set, onToggle, sentIds?, excludeIds?, showForYou=true, defaultMode? }`.
  With `showForYou`, it opens on the "For you" complementary matches from `/api/vendor/match`.
- See how it's wired today inside the invite modal in
  `app/vendor/network/NetworkManager.tsx` (~line 476) — copy that pattern: local
  `selected` Set + `onToggle`, and on invite call `POST /api/vendor/invites`
  (`lib/collab-network.ts createInvite`).
- **VendorHome doesn't currently receive `memberId`** (removed earlier). Add it back:
  `app/vendor/page.tsx` already resolves `memberId` — pass it into `<VendorHome>`.
- Gate on tier: sending invites = the $10 "act" tier (see pricing below). Free sees the
  matches (teaser) but invite is upgrade-gated.
- Effort: **medium** — mostly re-parenting an existing component + wiring the invite POST.

### Task B — "Opportunities near you" feed (the retention lever)
A feed of **open collab roles other hosts posted** ("El Tri Cantina wants a food partner
for Aug 15"), ranked by the matching engine. This is the answer to the frequency problem
— a reason to return *between* your own events.

- **New concept: an "open role."** Today lineups are `collab_invites` targeted at a
  specific `to_id`. An opportunity is an *untargeted* open role on an event. Options:
  - (a) New table `event_open_roles` (event_id, host_id, role, note, status). Cleanest.
  - (b) Reuse `collab_invites` with `to_id = null` + a `status='open'`. Less clean, no migration.
  Recommend (a) — small migration, clear semantics.
- Ranking: for the viewing member, score open roles by the matching engine
  (`lib/api.ts` `complementaryFor` / `matchObjective`) against the role/host. Start simple
  (same city + role fit) if the semantic call is slow.
- Surface it on the **business home** (Task A screen) below the matcher, and let hosts
  **post a role** from `/vendor/organize` (the lineup tab).
- Effort: **medium–high** — new table + endpoint + two UI touchpoints. This is the one
  genuinely new build.

### Task C — Shopper home restructure + collaborator avatar stacks
Make the shopper front door actually *lead* with the hook and show collaboration visibly.

- **Lead with Live + events.** `components/home/HomeTabs.tsx` default tab is `feed`
  (community posts). Consider defaulting to an events/live-forward view, or make the feed
  tab open with `LiveFeed` (already there) + upcoming events prominently, community posts
  below. The directory (`Shop` tab / `LocalDirectory`) stays but is clearly secondary.
- **Collaborator avatar stacks on event cards** (upgrade the text badge from Task 3).
  Extend `getAcceptedLineupCounts()` in `lib/collab-network.ts` to also return member
  `{id, name}` for the first N collaborators (it already collects `names`; add `to_id`).
  Add them to `FeedEvent` in `app/api/events/feed/route.ts`. Render an overlapping avatar
  stack (see the mock) in `components/live/CommunityEventsLive.tsx` `EventCard`, linking
  each to `/members/[id]`.
- **Demote the directory** to a clear "Browse all local businesses" entry, not the pitch.
- Effort: **medium**.

### Task order
A → C (avatar stacks) → B. A is highest signal (makes the matcher real); avatar stacks
are cheap and make collab visible; B is the biggest new build, do last.

---

## Reuse map (don't rebuild these)
| Need | Use |
|---|---|
| Semantic matches (complementary / NL search / convener) | `app/api/vendor/match` proxy → `lib/api.ts` (`searchMatches`, `complementaryFor`, `matchObjective`, `suggestLineup`) |
| Match UI (tabs, cards, select) | `components/match/MatchFinder.tsx` + `MatchCard.tsx` |
| Send an invite | `POST /api/vendor/invites` → `lib/collab-network.ts createInvite` |
| Event lineup (accepted collaborators) | `lib/collab-network.ts` `getEventInvites` / `getAcceptedLineup` / `getAcceptedLineupCounts` |
| Public events feed | `app/api/events/feed/route.ts` (`FeedEvent`) + `components/live/CommunityEventsLive.tsx` |
| Live-now feed | `components/live/LiveFeed.tsx`, `lib/broadcasts.ts` |
| Tier gating | `lib/entitlements.ts` (`FREE_CAN`, plan resolution), `components/vendor/PlanSwitch.tsx` |
| Client data cache | `lib/data-hooks.ts` (SWR shared keys) — reuse, don't `useEffect`+fetch |

## Constraints / conventions
- **Next.js 16** — read `node_modules/next/dist/docs/` before writing framework code (see AGENTS.md).
- Client fetching = **SWR via `lib/data-hooks.ts`**; never call `listMembers` from the browser (route via `app/api/directory`).
- Member profile pages are **server components**.
- Clerk: use `<Show when="signed-in">`, not `SignedIn`. `auth()` server-side.
- Design language (established this session): **flat hairline cards** (`.card-soft`, no
  shadow, radius 14), tight padding (`p-4`), unified button pill (`px-3.5 py-2 text-[13px]`),
  page titles `text-xl`, full-bleed feed media. Match it.
- **Review loop:** build on `feat/collab-rooms`, review on **localhost** (`npm run dev`),
  do NOT deploy per change. Deploy to prod only when the user approves.

---

## Related: pricing re-cut (separate decision, not required for the reshape)
Re-sequence the existing $10/$30 so payment follows proof and supply isn't taxed. Mostly
a config change in `lib/entitlements.ts` (`FREE_CAN` / Member / Pro), except the
transaction fee which needs paid ticketing (not built).

- **Free — Participate:** claimed profile, in the network, **receive invites**, join
  events/lineups, post, RSVP. (Today "receive invites" + claimed profile are $10 — move
  to free; don't tax supply/liquidity.)
- **$10 — Act (Organize):** send invites + the "For you" matcher, create/host events,
  lineups, blasts, "Opportunities near you". (Today's send-invites/organize is $30 — drop to $10.)
- **$30 — Capture (Run on it):** AI customer-service agent, voice booking, commerce
  (Stripe/Uber). (Today the agent is $10 — move up; it's the standalone-ROI capture tool.)
- **Transaction cut (new, across tiers):** small % on tickets/commerce so you earn when
  they earn — reduced/waived on $30. Needs paid tickets (Stripe-Connect-per-organizer),
  which is NOT built yet.

## The honest caveat (carry into any build session)
UI/IA fixes *positioning*; it can't manufacture demand. The real test isn't more features
— it's getting ~10 event-native businesses in one district onto it, helping one real event
happen, and watching whether anyone starts a *second* collaboration unprompted. Build
Task A so the app deserves that test; then go get the businesses. Don't keep building past
what the test needs.
