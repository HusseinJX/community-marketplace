# Auth & Verification — canonical model

Locked 2026-07-06. This is the source of truth for how members sign in, how we
prove ownership, and how enrichment relates to verification. Applies to both the
marketplace app and the connector-agent.

## The one principle

Two things people conflate — keep them separate:

1. **Login** = proving *you're a person* (an inbox you control). Handled by Clerk
   (email/social). Open to anyone. **Not** a business claim.
2. **Ownership** = proving *you control this business/identity*. A separate,
   deterministic check. This is the only hard part.

Login never grants business control. Ownership does.

## Entity vs. person (the real dividing line)

Verification exists to stop someone impersonating a **real thing that already
exists in the world and has something at stake.** So the split is not the
"core trio" — it's:

- **Entities** (vendors, community orgs): exist in the world independently
  (a Google Maps listing exists whether or not they signed up). The profile can
  be pre-created / harvested / impersonated → **an ownership anchor is REQUIRED.**
- **People** (artists, shoppers, individuals): self-create. There's no
  pre-existing listing to steal. **The account IS the ownership** — like a fresh
  Instagram account. **No anchor required to exist or control it.**

## Ownership anchors, per type

| Type | Required to own the profile | Optional (enrich + badge) |
|---|---|---|
| **Vendor** | **any of the 3 anchors** (below) | socials OAuth, website (from Maps) |
| **Community org** | **any of the 3 anchors** (below) | socials, website |
| **Artist** | **nothing — the account is self-owned** | socials OAuth, website |
| **Shopper / individual** | nothing — the account | optional socials |

Everyone signs up with **any** email (login), separate from all of the above.

### The three ownership anchors (entities pick whichever applies)

1. **Google Maps** — outbound OTP to the Maps-listed phone. Google = the
   authoritative directory (the *number*); WE verify possession. Only the real
   business can receive at its own listed number.
2. **Google Business OAuth** — the person logs into the Google account that
   *manages* the listing → we inherit Google's own owner-check. Stronger, needs a
   Google login. (Also the fallback when the Maps listing has no phone.)
3. **In-person admin vouch** — a trusted admin/rep physically confirms the
   business on-site and records the owner's number/email. Ground truth by a
   trusted human. **Needs no Google presence** — so it's the anchor for
   businesses/orgs (and artists) that have no Maps listing at all.

## Google Maps = the root of trust (for entities)

Google Maps listings are already verified by Google. So Maps vouches for what it
lists, and we inherit that trust — **no separate website verification/OAuth
needed:**

- We pull the **website + phone FROM the Maps listing (via Places API)** — NOT
  from free-typed fields. If a typed website/phone isn't the one on the Maps
  listing, it's not authoritative.
- **Enrich** from the Maps-listed website.
- **Verify ownership** by **outbound OTP to the Maps-listed phone** (see below).

Edges:
- **No website on the Maps listing** → enrich from Maps data itself (category,
  hours, reviews). Fine.
- **No phone on the Maps listing** → fall back to **Google Business OAuth**
  (logging into the Google account that manages the listing proves control).

## In-person admin vouch (anchor #3, and the no-Google fallback)

A trusted admin/rep physically visits, confirms the business is real and the
person represents it, and records the number/email the owner gives on-site. This
is the "human / field verification" tier — the same model field reps use to sign
up restaurants — and for local it's one of the *strongest* anchors: physical
ground truth. It's also the **only** anchor that needs no Google presence, so it
covers businesses/orgs (and artists) with no Maps listing.

Rules:
- **The admin is the trust root.** Fine at founder scale. At rep scale, add an
  **audit trail** (who set it, when, where) — a sloppy/socially-engineered rep is
  the failure mode.
- **The channel (number/email) is just how the owner logs in / gets linked** —
  the *admin's on-site confirmation* is what makes it trustworthy, not the channel.
- **Don't have the admin directly flip "verified" and leave.** Admin sets the
  trusted number/email → the owner does **one lightweight possession confirm**
  (OTP to the number, or an email confirm link) to activate. Result: human vouch
  **+** possession proof **+** audit trail, minimal friction.
- Built already: the admin `trustedPhone` field. Missing: the audit trail + the
  owner-side possession confirm to activate.

The **organizer-vouches-for-an-artist-at-an-event** path is the same pattern (a
trusted human onboarding someone in person) — a legit anchor for artists too.

## Possession must be OUTBOUND, not inbound ⚠️

Inbound caller ID / SMS `From` is **spoofable** — "they called us from the
number" is NOT proof. Flip it:

> **We send a one-time code TO the number** (SMS or voice) and they read it back.

Receiving at the number can't be spoofed; sending as it can. This is how
Google/Yelp do it, and it's the required correction to the possession gate.
(The current connector gate matches an inbound call `From` against an admin-set
`trustedPhone` — that must become an outbound OTP.)

## Enrichment ≠ verification (and cross-ref is enrichment only)

Two different jobs — never conflate:

| | Answers | Stakes | How |
|---|---|---|---|
| **Ownership** | "does this person control it?" | security | deterministic, ONE anchor, no AI |
| **Enrichment / cross-ref** | "is the scraped data about one business?" | data quality | fuzzy AI is fine |

- **Enrichment fills data. It never grants a badge, trust, or owner control.**
- An **enriched-but-unverified profile = the `unclaimed` directory listing**:
  visible (good — long-tail visibility), clearly marked unverified, **zero owner
  control** until an anchor is proven.
- The connector's `verifyCrossRef` (Gemini "do these describe the same
  business?") is a **consistency / data-quality** signal ONLY. Demote it: rename
  off `ownershipVerification`, never let it unlock control. It is fuzzy,
  non-deterministic, and does not prove ownership.

## Connected channels are additive AND self-proving

After ownership, a member can OAuth additional channels (IG/Twitter, etc.) to
enrich + link/display. Each connected channel **proves itself** (OAuth /
post-a-code) and attaches to the already-owned profile.

- For **vendors/orgs**, socials are **additive only** — never a substitute for
  the Maps anchor (otherwise anyone with an Instagram could claim a business).
- For **artists**, socials are **also additive/optional** — the account is
  already self-owned; OAuth just adds enrichment + a verified badge.

This is the clean version of "verify one, trust all": we do NOT infer that
channels belong together with an LLM. **Each channel is independently proven and
attached** — Maps OTP proves the business, IG OAuth proves the IG, both point at
the same profile. No confidence scores, no hallucination.

## Badges

- **Verified badge** = an ownership anchor (or a self-proving connected channel)
  was confirmed. Optional for people; the anchor for entities.
- The only real impersonation risk for artists is claiming to be a **famous**
  artist → handled by the optional social-connect verify + a **username
  squatting/dispute** process (same as any social platform).

## Dedup before enrich/create

Before creating a profile, match against existing members on strong identifiers
(priority order) to avoid duplicates and to consolidate channels onto one record:
1. phone (normalized) → exact
2. website domain → exact
3. instagram handle → exact
4. name + city → fuzzy (last resort)

Match → enrich/update the existing record instead of creating a new one.

## Status (built vs. designed)

**Built:**
- Clerk login. Web claim engine (`verify.js`: phone / google_maps / instagram /
  website_email / gemini; resolves Google Places phone). Cross-ref consistency
  (`verifyCrossRef`). Enrichment on all create paths (connector branch
  `feat/trusted-number-enrichment`). Admin `trustedPhone` field. Voice possession
  routing (inbound — needs the OTP fix).

**Designed, not built (the remaining work):**
1. **Outbound OTP** to replace the spoofable inbound possession. ← most important
2. **Pull website + phone from the Maps listing** (Places API) instead of trusting
   typed fields.
3. **Artist "username + optional connect socials"** flow (self-owned account).
4. **Dedup-before-create.**
5. **Demote `verifyCrossRef`** off `ownershipVerification` → data-quality only.
6. **Teams / ownership transfer / disputes** (Clerk Organizations when wanted).
7. **Re-verification / staleness** (Maps numbers change hands).
8. **In-person vouch: audit trail + owner-side possession confirm** to activate
   (the `trustedPhone` field exists; the activation step + audit log don't).

## One-liner

> Login proves you're a person. Businesses prove ownership with one of three
> anchors — Google Maps (outbound OTP to its phone), Google Business OAuth, or an
> in-person admin vouch — while artists are just people, so their account is
> self-owned. Everything else — websites, socials, cross-ref — is additive
> enrichment that never grants control on its own.
