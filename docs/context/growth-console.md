# Growth console — ads + SEO in one place (DEMO, 2026-09-23)

**Path: `/vendor/growth`. Deliberately unlinked — nothing in the vendor nav
points at it. It is reachable by typing the URL, behind the portal's Clerk
gate.**

Every number on it is invented. `lib/growth-demo.ts` and
`lib/growth-demo-seo.ts` generate a fictional Sunset District bakery. No ad
account is connected, no API is called, and the buttons change local React
state and nothing else. A permanent amber strip at the top of the page says so,
and it is not dismissible.

## What it is for

A local business that wants to run ads mostly cannot, and the agencies that do
it for them start around $1,000/month on a twelve-month contract. The console is
the product shape for doing it for them: link the accounts once, an agent
proposes the changes, the vendor approves them, and the reporting says plainly
how much of each number is actually known.

Five surfaces, one screen each:

| Tab | What it answers |
|---|---|
| **Overview** | Is this working, and what does the agent want to do about it |
| **Ads** | Every campaign across every network in one sorted table |
| **Search & profile** | Organic queries, Google Business Profile, site health |
| **Agent** | The queue — approve, dismiss, and set how much rope it has |
| **Connections** | What is linked, what we would ask for, what we can prove |

## The three decisions the design encodes

**1. The queue is the product.** Everything else is a report. Each proposal
carries its evidence in the vendor's language ("it optimises for the click, and
the click is not the thing you sell"), a projected impact, a stated confidence,
and a before → after diff. Autonomy is a dial — suggest only / act within limits
/ run it — and the limits are written on screen as rules the agent cannot cross.

**2. Attribution is graded, and the grade is on the page.** Three levels, shown
on the Overview and again under Connections:

- **Exact** — an order placed on WhatsLocal. The ad's outbound link carries a
  click id we wrote; the `orders` row carries it back; revenue is a join in our
  own database. Deterministic, unaffected by ad blockers or iOS.
- **Counted** — a lead on a landing page we host. We see the form fill because
  it happens on our surface. *This is the reason to host campaign landing pages
  rather than merely design them* — it extends measurement to vendors who do not
  sell through us.
- **Reported** — anything on the vendor's own site, i.e. whatever GA4 and the
  platforms claim. In the demo that is nothing, because no conversion events are
  configured, which is the ordinary state of a local business's analytics and is
  why "fix your tracking" is the first item in the queue.

**3. No pixel, anywhere.** Attribution is a first-party click id, not a tracking
SDK, so this feature does not touch the App Store "no tracking occurs" statement
and does not need `NEXT_PUBLIC_META_PIXEL_ID` or the Google tags (see the
shipping rules in CLAUDE.md — turning those on is a separate, deliberate act).

**The one line to decide before shipping for real:** uploading conversions *back
into* Google/Meta so their algorithms can optimise on them is the single largest
performance lever, and it is also sharing purchase data with a third party for
advertising — a privacy-nutrition-label change. It is off in the demo and the
copy says so.

## Platform access — the actual gating item

The code is the easy half. Our own access to each platform is not:

| Platform | What we need | Difficulty |
|---|---|---|
| Google Search Console API | OAuth | None. Could ship today. |
| GA4 Data API | OAuth | None. |
| Google Business Profile API | Allowlist request | Weeks, usually granted. |
| Meta Marketing API | App Review + Business Verification for `ads_management` | Real process. |
| Google Ads API | Developer token; **Basic** access is enough to manage real client accounts (15k ops/day) | The long pole — weeks, and it is reviewed. |

"Plug in their API keys" is not how it works: the vendor supplies OAuth consent,
**we** supply approved platform access. Nothing here can go live against a real
account until those are granted, which is precisely why the UI exists first.

## What is deliberately honest in the fixtures

The demo account **loses money in two places**, because a dashboard where
everything is green has nothing for an agent to do. Performance Max returns
0.7×; a Meta traffic campaign converts nothing at all. Two rules the fixtures
follow:

- **Deterministic.** Seeded PRNG, never `Math.random()` — a server/client
  mismatch hydrates badly, and figures that reshuffle on every navigation read
  as fake immediately.
- **The prose must match the table.** The agent's copy quotes rounded figures
  ("about $0.70 for every $1.00", "most days") because the window rolls forward
  daily, and `budgetCappedPct` is **derived from the series**, never declared —
  a hand-typed "limited 71% of days" beside a table that says 87% is the same
  failure as counting intent instead of results.

## The seam for the real version

The panels take plain data and do not know where it came from. To make it real:

1. `getCampaigns()` → a Google Ads + Meta Marketing client returning the same
   `Campaign`/`DayPoint` shapes.
2. `QUERIES` / `SITE_ISSUES` / `GBP` → Search Console + Business Profile clients.
3. `PROPOSALS` → generated per vendor by the agent, persisted (they need status,
   an author and an audit trail — a `growth_proposals` table), and applied by a
   writer that respects `GUARDRAILS` server-side. **The guardrails must be
   enforced where the write happens, not in the component that displays them.**
4. `CONNECTIONS` → `vendor_secrets` (service-role only) + OAuth callbacks, same
   shape as the Stripe/Printify/Square cards on `/vendor/integrations`.

## Open questions, not yet decided

- **Pricing.** Not gated at all today. The natural home is a `growth` capability
  under Pro in `lib/entitlements.ts`, but managing ad spend is worth more than
  the assistant and may want its own price — which on iOS means a new StoreKit
  product, not just a new Stripe price.
- **A spend floor.** Below roughly $300/month, Google cannot learn anything and
  the result will look like our failure. Worth deciding whether we decline those
  vendors rather than disappoint them.
- **This is a second product.** Different buyer, different sales motion,
  different support load. It runs on the marketplace's relationships but it is
  not a feature of the marketplace.
