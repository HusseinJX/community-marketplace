# Vendor sites — their domain, their repo, our hosting

Spec, 2026-09-23. Nothing here is built. What exists today is §0.

Written out of the Growth console demo (`docs/context/growth-console.md`): ads
need somewhere to land, and where that page lives decides whether any of the
reporting is true.

## The offer

**A site that looks like nobody else's, on the domain you already own, that we
keep fast and the agent keeps current — and you can take the whole thing with
you on any Tuesday.**

Not a website builder. We are not competing with Squarespace on features and we
would lose. We win on both ends of the page: the site is generated from data we
already hold (catalogue, photos, hours, events, reviews), and it is the landing
surface for ads we are already running. Nobody selling templates has either end.

## 0. What exists today

Nothing. A vendor's presence is their `/members/[id]` profile on our domain,
server-rendered by us, plus whatever site they separately own. `features/
storefront-theming.md` specs per-vendor theming **of that profile** — see §2,
which is where the two meet without colliding.

The relevant surrounding pieces that do exist: `lib/seo.ts` (metadata, JSON-LD,
`isIndexable`), the `/category` and `/city` landing pages, Stripe Connect
checkout, bookings, ticketing, and the image → catalogue capture that already
turns a photo of a menu into structured products.

## 1. The domain is the ownership

Everything in this spec follows from one line: **we host, they own the domain.**

Ownership on the web is the domain name. If `sunsetsourdough.com` resolves to
our infrastructure by CNAME, the vendor holds their brand, their SEO equity,
their email and a one-day exit. We hold the rendering. That is the Shopify /
Webflow / Ghost arrangement and nobody accuses those of hostage-taking, because
leaving is a DNS change.

`sunsetsourdough.whatslocal.ai` is the version that feels like a trap, and it is
also worse for them — the SEO accrues to us instead of to them, and an ad that
lands on someone else's domain converts worse.

**Three rules that make the ownership real rather than claimed:**

1. **The registrant is always the vendor.** We may register on their behalf as a
   convenience; the name is in their legal entity from the first minute. A
   domain held in our name is the one genuinely irreversible hostage and there
   is no version of it worth the friction it saves.
2. **We do not take their nameservers.** CNAME on a subdomain, ALIAS/ANAME at
   the apex. The single most common way a small business's world breaks is a
   nameserver change that silently drops their Google Workspace MX records and
   kills email for three days. **We never touch MX. We are not their DNS host
   and we are not their email host.**
3. **Leaving is a transfer, not an export.** See §4 — the repo *is* the site.

## 2. Start with a subdomain, not a migration

Most of these businesses already have something — a WordPress a nephew built, a
Squarespace they pay $23/month for. "Rebuild your whole site with us" is a large
ask that stalls the ads work behind it, and the ads work is the part that makes
money.

**So phase one is `offers.sunsetsourdough.com`.** One CNAME. Nothing existing is
touched, nothing is migrated, and their current site keeps working. That
subdomain holds the campaign landing pages, the lead magnets and the funnel —
which is exactly the set of pages that must be ours for the measurement in §6 to
work, and exactly the set they do not have.

The main site follows later, as an obvious upgrade once the first funnel has
made money, rather than as a leap of faith taken on our say-so.

**Where this meets `storefront-theming.md`:** the boundary is the domain.

- **On whatslocal.ai** — the member profile, the shop, the event pages. Always
  **our renderer**, theme tokens only, never a snowflake. These live inside our
  feed, our search and our cards; they have to stay consistent and upgradable.
- **On their domain** — generated files, bespoke by design (§3). Distinctive is
  the whole product here, and there is no shared feed for it to be consistent
  with.

Both specs hold. Neither has to bend.

## 3. Static files, a shared runtime, and a deliberate snowflake

**The site is static HTML/CSS/JS on a CDN. Anything dynamic is an embed pointing
back at WhatsLocal.** Cart, checkout, bookings, ticketing, events, the assistant
— all of it is a script tag or an iframe served from our domain, on our existing
rails.

This single rule buys three things at once:

- **Hosting costs nothing to operate.** Static files do not have an on-call
  rotation, a database to exhaust, or a server-side injection surface. We are
  not becoming a web host in the sense that carries pagers.
- **Commerce stays on our rails**, which is where the 5% lives.
- **Conversion still happens on a surface we own**, which is what keeps §6 true.

**Do not build a dynamic CMS for this. No vendor-supplied server-side code, ever.**

### Bespoke markup, shared runtime

The generated markup is a snowflake per vendor — that is the point of the offer.
The obvious objection is maintenance: 500 bespoke sites and a security fix or a
Core Web Vitals regression has to land in all 500.

Two answers, and the second is the real one:

**Every site loads one small `platform.js` from our CDN**, unversioned per site.
It owns the parts that must stay updatable — click-id capture (§6), the form
handler, the embed loader, consent. Bespoke markup, shared runtime. A fix to any
of that is one deploy for the whole fleet.

**And the fleet is patchable because an agent wrote it.** "Apply this change
across every site" is an agent task run against N repos with a build gate and a
diff a human reviews in aggregate. That is genuinely new — bespoke sites were
unmaintainable in 2015 because patching them was human-hours-per-site. It is not
free now, but it is a job rather than an impossibility. **Budget for it as an
ongoing operation, not a one-off.**

### Distinctive above the fold, conventional in the conversion path

A landing page whose form is a delightful experiment converts worse than a
boring one, and we are the ones holding the ROAS number when it does. The
generator may be as strange as it likes in the hero and as ordinary as possible
between "interested" and "submitted".

Performance is not negotiable either: the Growth console's top finding on the
demo account is a 4.2s homepage eating the ad budget. **A generated page that
fails its budget does not publish.** Static + CDN makes that easy to hold.

## 4. The source of truth is files in a repo

Not rows in our database. Not a proprietary block format. Plain HTML/Markdown
plus a content JSON, in Git.

That one decision answers the ownership question and the editing question at the
same time:

- **The export is not a feature we have to build.** The repo *is* the site.
  Plain static files run on any host on earth, so there is nothing to escape
  from — which is precisely why the lock-in fear dissolves.
- **Two editors, one history** (§5) falls out for free.

**Where the repo lives:** our GitHub org at first, one repo per site, with a
one-click **transfer to their GitHub account** — a real GitHub transfer, not a
zip labelled "export". A zip download stays available always, for the vendor who
has never heard of GitHub and still wants the reassurance.

**Be honest about who uses this.** Ninety-five percent of bakers will never open
the repo; they will talk to the agent. The repo is not really a feature they
use. It is the *proof they could leave*, and that proof is what makes them
comfortable staying. It costs almost nothing to offer and it is the entire trust
story.

## 5. Two editors, one history

The vendor's site is edited from two directions and this is the part that would
normally require inventing conflict resolution. Git already is the conflict
resolution.

- **Our agent** commits as `whatslocal-agent`, with a message saying what it did
  and why ("add /custom-cakes landing page — position 14.2 on 6,300 monthly
  impressions with no dedicated page").
- **Their Claude**, their freelancer, their nephew commits normally.
- **A push webhook** builds and deploys. Build failure blocks the deploy and
  leaves the live site on the last good commit.

**The agent never force-pushes and never rewrites history.** If it cannot
fast-forward, it opens a pull request and tells the vendor. One rewritten
history erases the ownership claim more thoroughly than any contract clause
could.

Everything the agent does to a site is therefore in the same queue as everything
it does to their ads — proposal, evidence, projected impact, approve — which is
already the shape in `docs/context/growth-console.md`.

## 6. Why hosting is the point: measurement

This is the reason the whole spec exists rather than "help them pick a builder".

`docs/context/growth-console.md` grades attribution in three levels. Hosting the
landing pages is what moves a vendor from the bottom grade to the middle one:

- **Exact** — an order placed on WhatsLocal. The click id we wrote comes back on
  the `orders` row.
- **Counted** — a lead on a page we host. We see the form fill because it
  happens on our surface. **This spec is how a vendor who does not sell through
  us gets here.**
- **Reported** — whatever their own GA4 claims, which for most local businesses
  is nothing at all, because no conversion event was ever configured.

Without the middle row we are reporting clicks, which is what the agency was
doing when it got fired.

### The click-id contract

Shared with the Growth console; defined here because this is where it lands.

- Every ad destination URL carries `?wlc=<id>`, written when the campaign is
  built. The platform's own `gclid`/`fbclid` ride along untouched.
- `platform.js` reads `wlc`, stores it first-party (cookie + `localStorage`) for
  90 days, and attaches it to every form post and every embed handoff.
- A lead row carries it. An order row carries it. Revenue is then a join in our
  own database — deterministic, no pixel, unaffected by ad blockers or iOS.

**No tracking pixel is installed on a vendor site by us.** That keeps this
feature clear of the App Store "no tracking occurs" statement (CLAUDE.md
shipping rules) and clear of ATT entirely. Uploading conversions back *into*
Google/Meta remains a separate, deliberate, off-by-default decision with a
privacy-label consequence.

## 7. SEO — two properties, not one duplicated twice

Their site and their marketplace profile are different pages with different
jobs, and the failure mode is generating a site that is the profile's text
reflowed.

- **Their domain is canonical for their brand.** Full `LocalBusiness` JSON-LD,
  hours, address, the lot.
- **The profile stays indexable** (`isIndexable` in `lib/seo.ts` already handles
  this) and points `url` → their site, with `sameAs` both ways.
- **No cross-domain canonical.** Different content, different pages, nothing to
  consolidate.
- **The generator must produce content the profile does not have.** If it cannot
  — a vendor with three sentences and one photo — it generates fewer pages, not
  padded ones. A thin duplicate on a new domain is worse than no domain.

The dedicated-page-for-a-real-query play (the "custom cakes sf" item in the
Growth console queue) is where this earns out: one page serves the ad *and* the
organic result, and it is a page we host, so the leads are counted.

## 8. Data model

The repo is the truth. Postgres holds only what has to be queried.

```sql
vendor_sites
  id uuid primary key,
  member_id text not null,
  domain text unique,            -- 'offers.sunsetsourdough.com' | apex
  domain_status text,            -- pending_dns | verifying | live | error
  cert_status text,
  repo_provider text,            -- 'github'
  repo_full_name text,           -- org/repo; survives transfer to their account
  default_branch text,
  current_commit text,
  build_status text,             -- queued | building | live | failed
  published_at timestamptz,
  archived_at timestamptz,       -- §9; never a deletion
  created_at, updated_at
```

```sql
site_builds
  id uuid primary key,
  site_id uuid references vendor_sites,
  commit text,
  actor text,                    -- 'agent' | 'vendor' | 'system'
  status text,                   -- queued | success | failed
  perf jsonb,                    -- LCP/CLS at build time; a failed budget blocks
  log_url text,
  created_at
```

```sql
site_leads
  id uuid primary key,
  site_id uuid references vendor_sites,
  member_id text not null,
  page_path text,
  form_id text,
  fields jsonb,                  -- what the person submitted
  wlc text,                      -- the ad click that produced it ← the point
  utm jsonb,
  created_at, contacted_at
```

```sql
ad_clicks
  id text primary key,           -- the value in ?wlc=
  member_id text not null,
  channel text,                  -- google_ads | meta_ads | …
  campaign_ref text,
  landing_path text,
  created_at
```

Leads are the vendor's customer data: **`site_leads` is service-role only**, and
exportable by the vendor as CSV on demand — same posture as `support_threads`.
`orders` gains a nullable `wlc` so the Exact grade is a join rather than a guess.

## 9. What happens when they stop paying

**The site stays up.** Read-only, no agent edits, no banner, no ads of ours on
it. Static files cost approximately nothing to keep serving, and a site that
goes dark the day a card declines is a reputational event for us, not for them
— the local baker tells everyone at the market.

Archive only after prolonged inactivity *and* notice *and* an offer to transfer
the repo, and `archived_at` is a state, never a delete.

## 10. Pricing

**Building and hosting the site is free.** The paid product is the agent that
runs it and the ads service around it.

A free, fast, distinctive site on the vendor's own domain is the strongest
acquisition offer we can put in front of a local business, it costs us static
hosting, and it installs the exact measurement surface that makes the ads
business work. Charging $10/month for it would trade the acquisition wedge for
rounding-error revenue, and it would tax supply in a supply-constrained market —
the same reasoning that moved `commerce` into `FREE_CAN` on 2026-08-14.

Domain registration is passed through at cost, in their name.

## 11. Build order

1. **`offers.<domain>` + forms + leads + click id.** Unblocks the ads product.
   No migration, no negotiation, one CNAME. Ship this alone and it is already
   worth having.
2. **Generated full site** from profile, catalogue, photos and events. Still
   static, still their domain, performance budget enforced at build.
3. **Repo hand-off** — GitHub transfer, zip, and the agent's PR discipline. Can
   move earlier for a technical vendor who asks.
4. **Fleet operations** — agent-applied patches across sites, aggregate diff
   review, `platform.js` as the always-current runtime.

## 12. What this spec refuses

- **No dynamic CMS**, no vendor-supplied server-side code.
- **No nameserver takeover, no MX.**
- **No domain held in our name.**
- **No pixel on a vendor site.**
- **No generated page that fails its performance budget.**
- **No agent force-push.**
- **Not a website builder business.** If the answer to "why us" is ever
  "because our editor is nicer", we have lost the thread — it is because the
  site is downstream of data we already hold and upstream of ads we already run.

## 13. Open questions

- **Do we register domains on their behalf?** Large friction reduction, real
  ongoing obligation: renewals, transfers, and someone's domain expiring on our
  watch. Leaning yes, with autorenew on and the registrant always theirs.
- **The generator's component vocabulary.** Fully free-form HTML maximises
  distinctiveness and maximises the fleet-patching cost. A small shared
  vocabulary with bespoke composition is probably right, but that is the same
  argument `storefront-theming.md` had, one domain over.
- **Who answers when their existing site breaks** after they point a subdomain
  at us and conclude we did it. Support script needed before phase 1 ships.
- **A spend floor for the ads half** (from the Growth console's open questions)
  applies here too: below roughly $300/month the funnel cannot be optimised and
  the site will be blamed.
