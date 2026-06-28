# Business Model & Economics

The money picture for WhatsLocal, captured from strategy work. Numbers are **illustrative models**, not market facts — they show the *shape* of the economics, not a forecast.

## What this business actually is (aka)
Not a pure marketplace — a **local commerce operating system** with a marketplace front-end. Closest comparables: **Square** (payments + merchant SaaS) × **DoorDash** (local demand + delivery) × **Yelp/Google Business** (discovery/SEO directory).
- **One-liner:** Shopify-grade tools + DoorDash-style local demand for small businesses, monetized by transactions, subscriptions, and placement — with catalog **aggregation as the engine** and **search/AI traffic as the cheap demand moat**.

## The core problem with transaction-only revenue
Today's only revenue is a **5% platform fee** (`calculateFees` in `lib/stripe-server.ts`) via Stripe destination charges. With destination charges, **the platform pays Stripe's fee (~2.9% + $0.30)** — and the fixed $0.30 destroys small local baskets:

| Order | 5% gross | Stripe (~2.9%+30¢) | **Net** |
|---|---|---|---|
| $15 | $0.75 | $0.74 | **~$0.01** |
| $30 | $1.50 | $1.17 | **~$0.33** |
| $100 | $5.00 | $3.20 | **~$1.80** |

→ At local order sizes, 5% nets **cents**. That's payment-rails pricing, not marketplace pricing (DoorDash/Uber Eats take 15–30% merchant + buyer fees).

**Fee-restructure levers (do first — free upside):**
- Buyer-side service fee (~10–15%, the DoorDash model)
- A **minimum fee** (e.g. `max(5%, $0.99)`) so $0.30 doesn't eat you
- Higher merchant take, or direct charges so the vendor absorbs Stripe fees

## Price impact on shoppers (keep it ≈ in-store)
On a $20 in-store item: **your 5% is ~$1; the price-raiser is delivery (+$5–10), not your cut.**
- **Pickup, vendor absorbs 5% → stays ~$20** (the "not more expensive!" hook)
- **Delivery → ~$26–33** (almost all of it the Uber courier fee — show it as its own line so people blame the courier, not you)
- Avoid menu inflation; earn from tools/tickets/placement, not sticker price. Cheap-as-in-store is *why* a shopper picks you over going direct.

## Revenue streams (ranked by leverage)
1. **Subscriptions / SaaS (the real money — recurring, ~pure margin)** — see tiers below. This is what turns "pocket change" into a valuable, high-multiple business.
2. **Tickets** 🎟️ — high-fee (people accept booking fees), low-cost (digital, no delivery), already half-built (events + Stripe), and **events pull in the crowd** = monetize + solve liquidity at once. Near the top of easy wins.
3. **Marketing & growth services** — placement, optimization, ad pixels (below).
4. **Transactions** — restructured per above; the meter, not the business.
5. **Delivery markup** — optional margin on Uber pass-through.

## Subscription tiers (most features already built)
- **Free** — basic listing, get found, manual catalog. (Hook.)
- **Pro (~$29–49/mo)** — front-facing **AI customer-service agent** (24/7, captures leads) · auto **catalog sync** (Composio) · **custom storefront** (theming) · **online presence** (SEO/AEO, found on Google + AI search) · analytics.
- **Premium (~$99+/mo)** — everything + **collab network** access (convener/collab rooms) · **automations** ("storefront on autopilot") · **placement credits** · **Verified Pro** · **optimization** ("we grow you").

Feature → status: AI assistant ✅ · catalog sync ✅ · collab network ✅ · verify ✅ · QR ✅ · photo→catalog ✅ · Live Now ✅ · storefront theming (specced) · 3D/AR (specced) · tickets (to build).
⚠️ Don't fully paywall *basic* trust/verification — offer "Verified Pro" enhancement instead.

## "Placement" = paid visibility
Shops pay to be featured / rank higher (the `featured_lists` rails, search ranking). Like "Sponsored" results. Sell featured slots + placement credits. People pay well for attention.

## Optimization = "we help you sell more"
AI reviews their listing → suggests better photos/descriptions/pricing, what to feature, when to go live, what's converting. Tied directly to *their* revenue, so easy to charge for. Premium-tier feature.

## Ad pixels as a service (marketing/growth tier)
Let businesses run ads to their profile and **measure ROI**:
- **Easy:** per-vendor Pixel ID (Meta/Google/TikTok) rendered on their profile → basic retargeting (weakened by ad blockers/ITP).
- **Premium (we're uniquely positioned):** **we own the checkout**, so fire **server-side purchase events** (Meta CAPI / Google Enhanced Conversions) with real $ value — accurate "your ad made this sale" tracking they can't get elsewhere. Trigger.dev fires it on every completed order.
- ⚠️ **Requires cookie-consent + privacy disclosure (GDPR/CCPA)** — do it properly.

## Automation architecture ("hands" + agents)
Don't build a Zapier-style GUI builder (huge work, competes with everyone). Build the **"hands"** — marketplace actions any AI agent can call — once, then:
- **Your AI** builds/deploys automations for the mass market (most shops won't BYO-agent).
- **Power users** plug in **their own Claude/Codex** to drive the same layer.
- **Stack:** your AI (builder) → **Trigger.dev** (runtime/clock, retries, cron) → **Composio** (connectors to their external tools) + **your hands** (marketplace actions).
- **Industry convergence:** this is MCP / agentic-commerce — you become a *surface agents act on* (like Shopify/Stripe are doing), riding the wave instead of building a silo. **Less work than a builder, and you're already half-built** (assistant already calls tools; connector is agent-based). Main work: harden API + wrap as MCP server + scoped agent login.

## Scalability of the stack
- **Stripe (payments):** cleanly scalable, linear. ⚠️ Platform eats **chargebacks/disputes** on destination charges — a margin risk that grows with scale + small vendors.
- **Uber Direct (delivery):** cleanly scalable, **pass-through** (buyer pays). Caveat: high delivery fee hurts *conversion*, not margin.
- **Composio (aggregation):** technically scalable, but a **per-vendor OpEx decoupled from revenue** — a connected-but-dormant vendor is **pure cost** (daily sync, $0 earned). Mitigate: sync dormant stores weekly, gate behind paid plan / has-transacted, lean on free Tier-0 manual/AI for the tail. Also a pricing dependency on Composio.
- **What the stack does NOT solve:** two-sided **liquidity / cold start**, **CAC**, trust/safety/support. The tech scales; the *market* doesn't automatically.

## How lucrative (illustrative)
Per active vendor doing $3k/mo GMV (~85 orders @ $35):
- **Today (5% only):** ~$38/mo net — can't cover support/CAC. A hobby.
- **Restructured (15% blended + Stripe):** ~$338/mo net. + SaaS ~$49/mo (~100% margin).

At scale (1,000 active vendors, $36M GMV/yr): ~$0.5M/yr today vs **~$4.2M/yr** restructured + SaaS. At 10,000 vendors → tens of $M/yr.

**Verdict:**
- **Thin-to-worthless at 5% + low scale.**
- **Genuinely lucrative** with: (1) take-rate restructure (~12–18% blended), (2) SaaS recurring revenue (drives both cash *and* valuation multiple — SaaS ~5–10× ARR), (3) tickets + placement + ad services, (4) thousands of *active* (not just listed) vendors.
- **Capital-efficient to operate** (Stripe/Uber pass-through, Composio small per-vendor) — **cheap to run, brutal to start.**
- **Outcome is bimodal:** gated by **liquidity, not the tech.** The low-CAC SEO/directory/Live-Now moat is the genuinely differentiated bet that tilts the odds.

## Priority order (highest leverage first)
1. **Restructure fees** (buyer service fee + minimum) — free, ~9× per-order economics.
2. **Ship subscription tiers** (AI agent is the anchor sell) — the real money.
3. **Tickets** — easy, high-margin, drives demand.
4. **Placement + optimization + ad pixels** — marketing/growth tier.
5. **"Hands"/MCP layer** — powers automations (yours) + BYO-agent (theirs); future-proof.
6. Guard the **Composio dormant-vendor cost**; budget for **chargebacks**; keep feeding the **SEO/directory demand moat**.

## Related specs
`native-app.md` · `storefront-theming.md` · `product-3d.md` · `virtual-tryon.md` · `event-photo-wall.md` · `composio-go-live-checklist.md`
