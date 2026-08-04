# Event sourcing — scraping calendars from the open web

How WhatsLocal pulls real events off other people's websites into the community
feed. Paste a site URL → discover its calendars → confirm which ones to watch →
a Trigger.dev task scrapes them on an interval, forever.

**Status (2026-08-02): BUILT AND RUNNING.** Ten sources, **796 events**, ~21s,
667 HTTP requests, **$0 model cost**, **721 events with map coordinates**. Code
lives in `lib/sources/`, output in `data/events.json` + `data/venues.json`,
recurring sweep in `trigger/event-sources.ts`.

```bash
npx tsx scripts/scrape-events.ts            # all sources → data/events.json
npx tsx scripts/scrape-events.ts sfpl tiat  # just these
```

Not yet wired: the `event_sources` migration and draft insertion — `persistDrafts()`
in the Trigger task is a deliberate stub, because a scraper that writes to the live
feed before a review queue exists is how a mis-parsed page goes public.

## Current run

| Source | Pattern | Pulled | Kept | Excluded | Reqs |
|---|---|---:|---:|---:|---:|
| San Francisco Public Library | per-event ICS | 400 | 266 | 134 | 408 |
| Funcheap SF | JSON-LD archive | 175 | 175 | 0 | 188 |
| Fort Mason Center | WP Events Calendar | 164 | 164 | 0 | 4 |
| Gardens of Golden Gate Park | WP Events Calendar | 50 | 50 | 0 | 1 |
| UCSF | Localist API | 115 | 64 | 0 | 2 |
| Downtown SF | HTML recipe | 41 | 41 | 0 | 42 |
| Yerba Buena Gardens Festival | WP Events Calendar | 29 | 29 | 0 | 1 |
| TIAT | Luma API | 18 | 18 | 0 | 19 |
| La Cocina | Squarespace JSON | 3 | 3 | 0 | 1 |
| SOMArts | JSON-LD listing | 3 | 0 | 0 | 1 |
| **Total** | | **998** | **796** | **134** | **667** |

**Nine of ten sources need no selectors at all** — they hand over structured data.
Only Downtown SF requires a hand-written recipe.

SOMArts pulled 3 and kept 0 because all three of its listed events are in the past.
That is correct behaviour, and the runner **prints `← all dropped`** rather than
reporting a clean zero — a source that returns rows but keeps none is otherwise
indistinguishable from a quiet week.

## Coordinates — `lib/sources/geo.ts`

**721 of 796 events carry a map pin**, which is what makes "events near me"
possible. The key move: **geocode VENUES, not events.** 796 events resolve to
~200 distinct venues (a 4:1 ratio that improves as sources repeat), and venues
don't move — so one cached lookup serves every event there, forever
(`data/venues.json`, committed).

Four tiers, cheapest first:

| tier | source | count |
|---|---|---:|
| **native** | the source published coordinates (Luma `coordinate`, Localist `geo`) | 34 |
| **source** | single-site source's own pin, for events with a blank venue (Fort Mason's 162) | 165 |
| **geocode** | Nominatim (free) → Google only where it fails | 266 |
| **unplaced** | honestly null | 75 |

Geocoding is **Nominatim first, Google only for its misses** — Nominatim handles
clean addresses but misses named venues ("House of Air"), which is exactly where
a fraction of a cent is worth spending. Nominatim resolved 82/200; Google
recovered 114 more, taking the venue cache to **196/200**. `triedGoogle` is
recorded per entry so a paid lookup never repeats. `--no-google` keeps a run
strictly free.

### Four traps, all of which produce a CONFIDENTLY WRONG pin

A wrong pin is far worse than a missing one: it silently shows an event to the
wrong person. Every one of these was caught by auditing output, not by reading code.

**1. Never append a city to a string that already names a place.** The original
`venueQuery` turned `"Santa Cruz Civic Auditorium, 307 Church St"` into
`"…, San Francisco, CA"`, and Google returned a real 307 Church St in the
Mission — a confident pin **70 miles** from the venue, sitting in "near me"
results. Locality now comes from the geocoder's **bounds/viewbox parameter**,
which biases without lying; only the STATE is ever appended.

**2. Native coordinates are exact but not necessarily local.** UCSF's calendar
carries events in Olympic Valley, 180 miles away. Adapter-supplied pins are now
bbox-checked like any other (`inBayArea`), which dropped them.

**3. Never fall back to a source's default pin for an event that named a venue.**
SFPL's Potrero and Richmond branches failed to geocode and were being pinned at
the Main Library, miles away. The default is now used **only** when the event has
no venue at all. Unresolvable venues stay `null`.

**4. Some "venues" are not places.** SFPL's "Virtual Library" and
"Bookmobiles / MOS" have no fixed location; pinning them to a building puts them
in proximity searches they have no business being in. A `PLACELESS` pattern
excludes them from geocoding entirely.

Also guarded: `plausible()` rejects integer-truncated junk — The Events Calendar
returns `geo_lat: 37, geo_lng: 122` for Yerba Buena, truncated *and* sign-flipped.
Whole-number coordinates are never a real venue fix.

### Venue quirks worth knowing

`venueTemplate` gives context to bare labels — SFPL says `"Excelsior"`, which
alone geocodes to Oakland. `venueAliases` handles the ones the template still
gets wrong: `"Main"` → `"Main Branch Library"` is not a real place, so it is
mapped to its actual address.

---

## Code layout

| path | role |
|---|---|
| `lib/sources/types.ts` | `ScrapedEvent` / `SourceDef` / `RunReport` |
| `lib/sources/fetch.ts` | polite fetch (bot UA, timeout, retry, request counting) + `pooled()` |
| `lib/sources/ics.ts` | dependency-free iCalendar reader |
| `lib/sources/adapters/*.ts` | one per platform pattern |
| `lib/sources/geo.ts` | coordinates: native → source pin → geocode, with a venue cache |
| `lib/sources/registry.ts` | **the curated source list** — becomes `event_sources` rows |
| `lib/sources/run.ts` | dispatch, exclusion, past-date drop, dedupe, reporting |
| `scripts/scrape-events.ts` | CLI → `data/events.json` |
| `trigger/event-sources.ts` | daily sweep + on-demand task |

### Adding a source

1. Identify the platform (see the pattern table below) — usually one probe.
2. Add an entry to `SOURCES` in `registry.ts`.
3. `npx tsx scripts/scrape-events.ts <id>` and read PULL vs KEPT.
4. If no pattern fits, write a recipe in `adapters/recipe.ts` **with a
   `minEvents` expectation**, since that is the only tier that can drift silently.

---

---

## The core idea: derive a recipe once, replay it forever

The naive design sends every scraped page to an LLM on every run. That is slow,
non-deterministic, unauditable, and costs money forever.

Instead: **the model runs at setup time and emits a _recipe_ — not events.** The
recipe is stored on the source row and executed deterministically on every
subsequent run. No model in the hot path.

```
ADD A SOURCE  (once, expensive, LLM)     EVERY RUN  (weekly, cheap, deterministic)
─────────────────────────────────────    ──────────────────────────────────────────
paste URL                                load recipe
  → crawl for calendars                    → fetch listing pages
  → you confirm which ones                 → extract items via stored selectors
  → strong model reads real HTML           → fetch structured feed (.ics / JSON-LD)
  → emits an extraction recipe             → dedupe on stable UID
  → first scrape runs immediately          → insert as drafts
```

### Three extraction tiers, cheapest first

1. **Structured feed** — `.ics` / iCalendar, or JSON-LD `Event`. Parsed directly.
   Exact times, stable UIDs, zero ambiguity, zero model cost. **Always prefer this.**
2. **Recipe replay** — LLM-derived CSS selectors / regexes, executed deterministically.
   Zero model cost per run.
3. **LLM extraction** — the fallback, for sites too irregular to pin down. The only
   tier with a recurring per-run cost.

SFPL lands in tier 1.

### Recipes drift — that's the cost of this design

A recipe is a bet that the site's markup is stable. When a site redesigns, the
recipe silently returns zero events — and "zero new events this week" looks
exactly like a quiet week. So every recipe carries **validation** with it:

- expected item-count range (e.g. "a week should yield 50–400")
- required non-null fields (title, date)

Violating those does **not** fail silently. The source flips to `error`, the
strong model re-derives the recipe, and the **last-good recipe is retained** so a
bad re-derivation can be rolled back. Self-healing, but explicitly.

---

## Discovery: finding the calendar in the first place

The calendar is almost never at the URL a person would paste. So discovery is a
**bounded, prioritized, same-origin crawl**:

- **Seeds** — the pasted URL, `/sitemap.xml` filtered to event-ish paths, and probes
  of the usual suspects: `/events`, `/calendar`, `/whats-on`, `/happenings`,
  `/programs`, `/schedule`.
- **Frontier** — same origin only, **depth ≤ 2, max ~25 pages**, 5 concurrent,
  `robots.txt` respected, 10s timeout each.
- **Link scoring, not blind crawling** — href or anchor text matching
  `event|calendar|whats-on|happening|program|workshop|schedule|agenda`, weighted up
  when the link is in the nav. Highest scores first; **stop early** on a strong
  signal like an `.ics` feed.
- **Signals harvested per page:**
  - `.ics` / `webcal:` links, `<link rel="alternate" type="text/calendar">`
  - JSON-LD `Event` blocks
  - third-party embeds by iframe/script src — Eventbrite, Luma, Meetup,
    Ticketmaster, Dice, Tockify, Teamup, and **Google Calendar** embeds
    (`calendar/embed?src=<id>` converts straight to a public `.ics` URL)
  - pages that merely *look* like a calendar (many dated links in a list)

The model runs **once at the end**, over the collected candidates, to label and
dedupe them. Never per page. It only labels links we actually found — it is never
asked to produce a URL, so it cannot hallucinate one.

### Known limitation: no JavaScript

A fetch-only crawler sees no client-rendered content. Squarespace/Wix/React
calendars are often still caught via their embed or feed URL, but not always.
When discovery comes back thin, the UI says so plainly and lets you paste the
calendar URL directly. Headless rendering would close the gap and carries a real
resource cost — deferred until we know how often it actually bites.

---

## Case study: SFPL (sfpl.org) — verified live 2026-08-02

The reference implementation. A Drupal 10 site, close to the best case.

### What was measured

| | |
|---|---|
| Events scraped | **210 / 210** reported for the week of Aug 2 |
| Wall time | **16 seconds** |
| HTTP requests | **215** (5 listing pages + 210 calendar files) |
| Model cost | **$0.00** — no LLM in the run |
| ICS parse errors | **0** |
| title / date / time / location / branch / UID / access | **100%** |
| description | **82%** (37 events have none) |
| `CLASS:PUBLIC` | **210 / 210** |

### The route

**Discovery succeeded at depth 1** — the homepage links straight to `/events`.
`robots.txt` permits it (only `/core/`, `/admin/`, `/search/` etc. are disallowed).

**The listing page carries the event IDs.** Each card has
`href="/quickview/161765"` — and `161765` is the same ID the calendar endpoint
uses. So detail pages are **never fetched**.

```
GET /events?date-from=08/02/2026&date-to=08/08/2026&items_per_page=50&page=N
  → <article about="/events/2026/08/02/workshop-intro-photography" …>
      .date-display-range          → "Sunday, 8/2/2026, 2:00 - 3:00"
      .event__title a span         → "Workshop: Intro to Photography"
      a[href^="/quickview/"]       → 161765          ← the ID
      .location--short-label       → "West Portal"
      a[href*="audience_target_id"]→ "All Ages"
      a[href*="topic_target_id"]   → "Art, Architecture & Photography"

GET /sfpl-events/add-to-calendar/161765     → 581 bytes of iCalendar
      UID:161765@sfpl.org                   ← stable, survives edits
      DTSTART:20260802T210000Z              ← exact UTC
      LOCATION:West Portal - West Portal Teen's Area
      CLASS:PUBLIC                          ← access, stated by the source
```

### Query parameters that work (verified)

`date-from`, `date-to`, `items_per_page` (50 confirmed),
`field_event_location_target_id` (branch), `field_event_topic_target_id`,
`field_event_audience_target_id`, `keys`, `sort_by`, `page`.

**These are the filtering mechanism.** Because SFPL filters server-side, a
narrowed source fetches less — filtering happens *before* the network cost, not
after.

### Two off-by-one traps — both found by verification, not by reading

**`date-to` is EXCLUSIVE.** `date-from=08/02&date-to=08/08` returns **210** events
(Aug 2–7). The true week is **258** (Aug 2–8). Saturday alone holds 49 — a busy
library day, silently dropped every single run. `date-from=08/08&date-to=08/08`
returns **0**, which is the clean proof.

> The recipe must set `date-to` to **the day after** the intended window end.
> Nothing about the response signals the truncation: the page cheerfully reports
> "210 results" and every one of them is real.

**Pagination is not stable, and it duplicates.** Scraping the 258-event window
across 6 pages yields **259 article blocks for 258 unique events** —
`/events/2026/08/04/storytime-toddlers-3` (quickview `132877`) appears on **both
page 0 and page 1**, identical UID, time and branch. SFPL's own "259 results"
count includes the duplicate.

> Dedupe on the **stable ID** (`quickview` / ICS `UID`), never on ordinal position.
> And note the darker corollary: a listing that can serve the same row twice across
> a page boundary can also **skip** one. Validation should compare unique-count to
> reported-count and re-fetch when the gap is bigger than a couple of rows. Larger
> `items_per_page` reduces the number of boundaries and therefore the exposure.

Neither of these is visible from reading the HTML. Both were caught only by
counting the output and asking why the number was odd — which is the argument for
recipe validation carrying **hard expectations**, not just "did it parse".

### Volume and horizon

| Window | Events |
|---|---|
| Week of Aug 2 / Aug 9 / Aug 16 | 210 / 236 / 175 |
| August | 964 |
| September | 813 |
| October | **5** |
| November | 1 |

**~200 events/week, ~1,800 in the whole forward catalog, and a hard cliff after
~2 months.** That is a publishing horizon, not a quiet autumn.

Three consequences:

1. **Scrape a rolling ~60-day window**, not "everything" — a 6-month window burns
   fetches on empty pages.
2. **First run ≠ ongoing runs.** The initial sync sees ~1,800. Every weekly run
   after only picks up what newly entered the window — roughly **200 new** — because
   dedupe on the event URL slug drops the rest before any calendar file is fetched.
3. **Filtering is mandatory, not optional.** 200/week from one library system would
   swamp the feed, and it is mostly storytimes repeating across 29 branches. Per
   branch it is ~7/week — a usable neighborhood feed.

### The trap that didn't bite

A raw SFPL **event detail page is 221KB, almost entirely nav** — every branch
address sits in the site chrome. Feeding that to a model would very likely
mislabel the location. Extracting `<main>` first cuts it to 2.8KB of clean text.

We avoid this entirely by never fetching detail pages — but **generic boilerplate
stripping is still required for tier-3 sites**, and `<main>` is not universal.

---

## Case studies: three more sites — verified live 2026-08-02

Probed to stress-test the design against sites that are *not* a tidy Drupal
install. **Discovery found the calendar on all four at depth ≤ 2.** Three of the
four resolve to tier 1 — a structured feed, no model ever.

| Site | Platform | Tier | Feed | Upcoming | Horizon |
|---|---|---|---|---|---|
| **SFPL** | Drupal 10 | **1** — ICS per event | `/sfpl-events/add-to-calendar/{id}` | 210/wk · ~1,800 | ~60 days |
| **La Cocina** | Squarespace | **1** — JSON | `/events?format=json` | 3 (+23 past) | open |
| **Downtown SF** | ctykit CMS | **2** — recipe | none | 41 | **~30 days** |
| **TIAT** | Luma | **1** — ICS | `api.lu.ma/ics/get?…` | 18 (+262 total) | open |

### Two platform tricks that generalize far beyond these sites

**Squarespace: append `?format=json` to any collection URL.**
`lacocinasf.org/events?format=json` returns 88KB of structured JSON — no scraping,
no selectors, no model. Event collections put events in **`upcoming` / `past`
arrays** (not `items`, which is empty for this collection type). Fields:
`title`, `startDate` / `endDate` (epoch ms), `fullUrl`, `location`
(`addressTitle` / `addressLine1` / `addressLine2`), `body` (196–376 chars of real
HTML). `?format=ical` returned HTML — it only works on true calendar collections,
so **don't rely on it; use `format=json`.**

This one pattern likely covers a large share of small-business and nonprofit sites.

**Luma: `https://api.lu.ma/ics/get?entity=calendar&id=cal-XXXX`.**
The calendar ID is discoverable from the org's *own* site — tiat.place embeds
`luma.com/embed/calendar/cal-twiOosdGMMY66DI/events`. That feed returned **262
VEVENTs (18 upcoming)** with `UID`, `SUMMARY`, `DTSTART`, `DTEND`, `LOCATION`
(full street address), and `DESCRIPTION` at **100%**.

So the discovery crawler should treat "a Luma embed" as a **first-class strong
signal** — same tier as finding an `.ics` link, because it converts into one.
A public JSON API also exists (`api.lu.ma/calendar/get-items`), but the ICS
endpoint is the more stable contract.

### Per-site notes

**La Cocina** — 3 upcoming events, 23 past. A small org posts rarely, so the value
is a handful of high-quality events (Outside Lands, a cohort pop-up dinner, the SF
Street Food Festival), not volume. **Filtering is irrelevant here; freshness is the
whole game.** Squarespace also serves `past` events — the recipe must exclude them.

**TIAT** — 18 upcoming, and the calendar carries events hosted *elsewhere*
(one at Pebblebed, not the 151 Powell gallery), so `LOCATION` must be trusted per
event rather than assumed from the source. **No `URL` and no `CLASS` field:** the
event link is embedded in `DESCRIPTION` as "Get up-to-date information at:
https://luma.com/…" and must be extracted with a regex. Access has no hard signal —
a public Luma calendar implies public, but many entries are RSVP/ticketed, so this
is the one source of the four where the public-vs-private tier-3 judgment actually
runs.

**Downtown SF** — the only tier-2 site, and cleanly structured:

```
.evcard                       → a[href^="/do/"]
  .evcard-content-headline    → "A Night with Madson Wines"
  .evcard-content-time        → "6:30pm - 9pm"
  .evcard-content-venue       → "Verjus"
  .evcard-date-dow/day/month  → "Thu" / "13" / "Aug"      ← NO YEAR
```

Three wrinkles worth recording:

1. **The card has no year.** Either infer it (with a rollover rule at the Dec→Jan
   boundary) or fetch the detail page, which states `Thursday, Aug 13, 2026` plus a
   street address and a full description in a clean 33KB page. **Prefer the detail
   fetch** — a wrong year is a silently broken event.
2. **The date filters are client-side.** `?start=`/`?end=`/`?date=` all return the
   same 41 events — the picnic datepicker filters already-loaded DOM. There is no
   server-side pagination, so one fetch gets everything.
3. **~30-day horizon** (40 events in Aug, 1 in Sep). A weekly scrape picks up new
   events as they enter the window; there is no deep catalog to backfill.

Its events page also links out to Eventbrite listings — a reminder that one source
can imply another, and that cross-source dedupe will matter once two sources cover
the same event.

### Full extraction run — all four sources, 2026-08-02

All four scraped end to end into one normalized list. **320 events, ~14s total,
$0 model cost, 0 missing titles, 0 missing dates.**

| Source | Events | Time | Route | No description | No access signal |
|---|---|---|---|---|---|
| SFPL | 258 | 9.4s | listing → quickview id → ICS | 43 | 0 |
| Downtown SF | 41 | 3.1s | listing → 41 detail pages | 0 | 41 |
| TIAT | 18 | 1.3s | Luma JSON API + og:description | 1 | 0 |
| La Cocina | 3 | 0.4s | `?format=json` | 0 | 3 |

Three findings that only appeared once everything was actually extracted:

**Luma's ICS has no event description.** `DESCRIPTION` contains only
`Get up-to-date information at: <link>`, the address, and the host — no body text.
The JSON API's `description` / `description_mirror` are **null** on both the list
and the per-event endpoint. The blurb has to come from the event page's
`og:description`, which is truncated with an ellipsis but usable (17/18 recovered).

**For Luma, prefer the JSON API over the ICS.** `api.lu.ma/calendar/get-items`
returns **`visibility: "public"`** — the access signal the ICS omits entirely —
plus a structured `geo_address_info` and a cover image. Use ICS only as a fallback.

**An event is not always a point in time.** Four Downtown SF entries looked like
stale March–July events; they are **ongoing exhibitions**. Its `.dldate` holds
either a single date (`Thursday, Aug 13, 2026`) or a **range**
(`Sat, Mar 21, 2026 - Sat, Sep 5, 2026`) — note the weekday is spelled out in one
form and abbreviated in the other, so a single regex must handle both.

> Parse **all** dates in the field: first = start, second = end. Filter on the
> **end** date, never the start — otherwise every currently-running exhibition is
> silently dropped. 7 of 320 events here carry a range.

**Access is the one place a model is still needed.** 276 of 320 state it outright
(`CLASS:PUBLIC`, `visibility:public`); the remaining **44 — all of Downtown SF and
La Cocina — give no machine-readable signal at all.** That is the tier-3 judgment
call, and it is ~14% of events rather than the majority.

### What this changes

- **Tier 1 is the common case, not the lucky case.** 3 of 4. The recurring model
  cost across all four sources is **$0**.
- **Platform detection should run before crawling.** Recognizing Squarespace, Luma,
  Drupal, or Eventbrite immediately yields a known feed and skips discovery
  entirely. That is a lookup table, not intelligence, and it should be the first
  thing discovery tries.
- **Volume varies by 70×** — 210/week from SFPL, 3 upcoming from La Cocina. The
  Sourcing tab must not present these as the same kind of thing: one needs
  aggressive filtering, the other needs a freshness check.
- **Horizons vary too** (30 / 60 days / open-ended), so the scrape window belongs
  in the recipe, per source, not as a global constant.

---

## Content filtering: what we exclude

Scraping a source is not the same as wanting everything on it. Exclusion rules
live on the source row (`filters`) and run **after** extraction, before drafts.

**Storytimes are excluded.** They are ~29% of SFPL's volume — 29 "Storytime for
Toddlers", 18 "for Babies", 16 "for Families" in a single week — repeating weekly
across 29 branches. They are a great library service and terrible feed content:
identical titles, no description, and they bury everything else.

The rule is clean because SFPL tags them: drop anything whose **topic** starts with
`Storytime` or whose **title** matches `^Storytime:`. That is a tag match, not a
guess. Roughly 63 of 258 events in the sample week.

The general principle: **exclusion belongs in the recipe, expressed in the source's
own vocabulary** (its tags, its categories), never as a fuzzy content judgment.

---

## Candidate sources for SF — probed 2026-08-02

Twenty candidates probed for platform, feed availability, and volume.

### Confirmed goldmines — structured data, no model needed

| Source | Route | Volume | Why it matters |
|---|---|---|---|
| **Fort Mason Center** | `wp-json/tribe/events/v1/events` | **1,663** events, 34 pages | Larger than SFPL's entire forward catalog. Arts campus: markets, exhibitions, festivals, classes |
| **Funcheap SF** | daily archives → JSON-LD `Event` | **~24/day** (~720/mo) | Human-curated **free** SF events. The closest thing to a mission-aligned firehose |
| **YB Gardens Festival** | `wp-json/tribe/events/v1/events` | 32 | Free outdoor performances downtown |
| SFPL · Downtown SF · TIAT · La Cocina | *(already validated above)* | 320 | |

**Fort Mason and YB Gardens confirm a fourth platform pattern** —
**WordPress + The Events Calendar**, which exposes *both*
`/wp-json/tribe/events/v1/events?per_page=50` (paginated JSON with `total` /
`total_pages`) and `/events/?ical=1` (a full ICS export; 30 VEVENTs each). This
plugin is extremely common on nonprofit and venue sites, so the pattern is worth
building in as a first-class probe.

**Funcheap** is the most interesting of the three. No Tribe, no ICS — but every
individual event page carries **JSON-LD `Event`** (name, description, `Place`,
`Offer`) and the site exposes **date archives at `/YYYY/MM/DD/`** with ~24 event
links each. So the recipe is: walk the date archives for the window, follow each
link, parse JSON-LD. No selectors to drift, because JSON-LD is a standard.

### The four platform patterns now proven

| Platform | Endpoint | Verified on |
|---|---|---|
| **Drupal** (per-event ICS) | `/…/add-to-calendar/{id}` | SFPL |
| **Squarespace** | `<collection>?format=json` | La Cocina |
| **Luma** | `api.lu.ma/calendar/get-items?calendar_api_id=cal-…` | TIAT |
| **WP + The Events Calendar** | `/wp-json/tribe/events/v1/events` · `/events/?ical=1` | Fort Mason, YB Gardens |
| *(any)* **JSON-LD `Event`** | on the event page itself | Funcheap |

Platform detection should run **before** the crawl. Four lookups cover a large
share of real sites and skip discovery entirely.

### Needs a recipe (tier 2)

- **Downtown SF** — already built above.
- **DoTheBay** — ~51 event links; blocks the bot UA, responds to a browser UA.
  Music-heavy aggregator, good coverage of venues we would otherwise scrape one by one.

### Harder or blocked — deprioritized

| Source | Problem |
|---|---|
| SFJAZZ | **403** even with a browser UA |
| FAMSF (de Young / Legion) | connection timed out on the calendar page |
| Presidio | WordPress underneath, but a Next.js frontend intercepts `/wp-json/…` and returns HTML — Tribe is unreachable |
| SFMOMA · YBCA · Asian Art · Cal Academy · Exploratorium | WordPress/Drupal but no feed found at the standard paths; each needs its own probe |
| SF Rec & Park · Union Square Alliance | no event links found at the guessed URLs — the real calendar path was not located |

**Not yet probed, likely worth it:** Eventbrite (has a real API), Meetup,
university calendars (USF / SF State / CCSF — often **Localist**, which exposes a
documented JSON API), CUESA farmers markets, Stern Grove Festival, Sunday Streets,
and neighborhood BIDs beyond Downtown SF (Castro, Japantown, North Beach, Hayes
Valley) — the Downtown SF recipe may port directly to any that also run ctykit.

### Suggested order

1. **Funcheap** — best mission fit (free events), JSON-LD, no drift risk.
2. **Fort Mason** — highest volume, and proves the Tribe pattern at scale.
3. **YB Gardens Festival** — same pattern, near-zero marginal cost.
4. **DoTheBay** — first real tier-2 recipe beyond Downtown SF.

---

## Source pipeline — probed 2026-08-02, ~85 URLs, 71 live

Verified reachable and pattern-detected. **404s below usually mean a wrong guessed
path, not an absent calendar.**

### SF — not yet in the registry

**Structured feed confirmed — near-zero effort to add:**

| source | pattern |
|---|---|
| Grace Cathedral | WP-Tribe · JSON-LD · ICS |
| Internet Archive | WP-Tribe · JSON-LD · ICS |
| 826 Valencia | WP-Tribe · JSON-LD · ICS |
| Root Division · Presidio | WP-Tribe |

**Real calendar, needs a look:** Exploratorium (Drupal ~29), SFMOMA (~12), YBCA (~25),
Gray Area (~25), ODC Dance (~19), SF Planning (~18), CUESA (~13), Parks Conservancy,
Southern Exposure, **Bottom of the Hill (~65 event links)**, Stern Grove + Balboa
Theatre (Squarespace → `?format=json`), The Chapel / GAMH / Castro CBD
(Eventbrite-backed), The Independent, Rickshaw Stop, The Roxie, Sunday Streets,
Chinatown CDC, Fisherman's Wharf.

**Blocked / wrong path:** de Young + Legion (403), Asian Art (404), Japantown (404),
SF Rec & Park, Union Square Alliance, Noisebridge, Long Now.

### Other cities — the same four shapes, everywhere

| City | Verified |
|---|---|
| **Oakland** | Oakland Public Library · Visit Oakland (~22) · **OMCA — JSON-LD + ICS** |
| **San Jose** | SJPL (~53) · **SJ Downtown Assn — ICS** · Team San Jose |
| **San Diego** | **Balboa Park — JSON-LD + ICS** · Downtown San Diego |
| **Los Angeles** | LA Public Library (~25) · Grand Park · LACMA (~10) |
| **Houston** | Houston Public Library · Visit Houston (~23) · Discovery Green |
| **Dallas** | Dallas Public Library (~18) · **Downtown Dallas Inc — JSON-LD + ICS** |
| **Denver** | Denver Public Library · Downtown Denver · Denver Botanic Gardens |
| **Chicago** | Chicago Public Library · **Choose Chicago — JSON-LD + ICS** · Chicago Park District |
| **Miami** | Miami-Dade Library · Bayfront Park (Squarespace ~25) |

> **Every city has the same template: public library + downtown association +
> parks/gardens + a museum** — and they run the same handful of platforms. Downtown
> Dallas, Choose Chicago, SJ Downtown, Balboa Park and OMCA are all WP-Tribe, which the
> existing adapter already handles. **A new city is mostly registry entries, not code.**

### Resources for residents

**`askdarcel.org/api` is a live public JSON API — 427 categories confirmed.** It is the
backend for SF Service Guide (ShelterTech / Code for America): food, shelter, health,
legal, hygiene, with eligibility and hours already structured. The resources endpoint
needs correct params (a bare call 400s) — **worth finishing, it is the AskDarcel
equivalent of finding SFPL's ICS.**

Also live: findhelp.org · 211.org · **Open Referral / HSDS** (the open standard for
human-services data — the "ICS of resources") · DataSF.

Orgs verified: SF-Marin Food Bank · SF HSA · **GLIDE** (WP-Tribe) · **St Anthony's**
(WP-Tribe + ICS) · SF Housing Rights Committee · La Raza Centro Legal · Mission
Neighborhood Health · Homeless Prenatal Program.

### Resources for businesses

**Renaissance Entrepreneurship** and **SF Chamber of Commerce** both expose ICS — their
workshops arrive as *events*, not just static listings.

Also live: Working Solutions CDFI · NorCal SBDC · CalOSBA · Main Street Launch ·
SBA SF · Pacific Community Ventures · MEDA (Eventbrite).

### Resource recommendation — the same two-sided model

Resources suit this **better than events**, because they do not expire: label once,
reuse for years. No re-scrape, no date filtering, no timing drift.

- **Resource states who it is for** — income limits, age, immigration status, language,
  family situation, neighbourhood, insurance, documents needed, walk-in vs appointment.
- **Person states who they are** — same fields, in their own words.
- **Business version is strongest**: no interview needed. The profile, story,
  `businessSize` and `ownershipTags` already exist, so a new solo food business gets
  permits, kitchen space and microloans without answering anything.

> **Eligibility is higher-stakes than a bad event pick.** Telling someone they qualify
> for help they do not is a real harm. Show eligibility as **stated facts to check**,
> never as "you qualify".

---

## Data model

### `event_sources`

The watched calendar. One row per confirmed candidate.

| column | notes |
|---|---|
| `site_url` / `feed_url` | what you pasted / what we actually fetch |
| `label`, `kind` | "SFPL — Glen Park", `calendar`\|`ics`\|`eventbrite`\|`schedule`\|… |
| `owner_member_id` | **required** — `vendor_events.member_id` is `NOT NULL` |
| `recipe` (jsonb) | selectors, pagination, date window, validation bounds |
| `recipe_last_good` (jsonb) | rollback target after a bad re-derivation |
| `filters` (jsonb) | source-native query params (branch, topic, audience) |
| `interval_minutes` | **default weekly** |
| `next_run_at`, `last_run_at` | the sweep reads `next_run_at` |
| `status` | `active` \| `paused` \| `error` |

### `event_source_runs`

One row per run: counts pulled / published / deduped / held, duration, error.
This is deliberately the shape the `/prototype/admin` Sourcing mock already
draws, so the real data can flow into that dashboard.

### `vendor_events` additions

`source_id uuid`, `source_url text`, `external_uid text`.
Dedupe on `external_uid` where present, else `(member_id, title, event_date)`.

---

## Scheduling — `trigger/event-sources.ts`

**One sweep, not one cron per source.** `sweepEventSourcesTask` is a single
`schedules.task` at `0 9 * * *` (09:00 UTC, early Pacific morning) that runs
whichever sources are due. `scrapeEventSourceTask` handles "Run now" and the
first scrape at confirm time.

Adding a source is a registry entry — later a DB insert. No dynamic schedule
registry to keep in sync, no orphaned crons when a source is deleted.

- **Tick: daily, not hourly.** With weekly intervals, an hourly tick would be 720
  no-op runs a month to buy scheduling precision nobody can perceive. "Run now"
  covers urgency.
- **Per-source cadence** in `INTERVAL_DAYS`: Funcheap every 3 days (curated daily,
  highest churn), most sources weekly, low-volume ones fortnightly.
- **Staggering:** until `next_run_at` exists, each source is offset
  deterministically by a hash of its id, so they don't all fire on the same day.
  That whole block collapses into `WHERE next_run_at <= now()` once the migration
  lands.
- Same fallback as Composio: if `TRIGGER_SECRET_KEY` is unset, the scrape runs
  inline in the request.

### Deploying it

```bash
npm run trigger:deploy        # registers the schedule
```
Requires `TRIGGER_PROJECT_REF` + `TRIGGER_SECRET_KEY` (both already set locally).
**Not deployed yet** — deliberately, per the note at the top of this file.

---

## Publishing policy

Scraped events land as **drafts** (`vendor_events.active = false`) for approval. A
scraper misreading a page must never put junk in the public feed.

### "Is it open to the public?"

A first-class field on every scraped event, **defaulting to public-only**, decided
in tiers:

1. **Hard signals** — ICS `CLASS:PUBLIC`; "drop-in, no registration necessary";
   "free and open to the public".
2. **Exclusion signals** — members-only, staff, private, invite, ticketed-restricted,
   `FULL:` (SFPL prefixes full events this way).
3. **Model judgment** — only when 1 and 2 are both silent, and only for new events.

Anything **uncertain goes to a `held` bucket** — not published, not discarded.
Silently dropping loses real community events; silently publishing puts a private
meeting in the feed.

---

## Schedules that aren't calendars

- **Recurring event** ("every Tuesday 6pm") — ICS `RRULE` parsed directly. For prose,
  the model extracts a recurrence rule which we expand into concrete occurrences
  inside the scrape window, capped, and flagged as recurring so the feed collapses
  them rather than showing 52 rows.
- **Schedule as a table** (class timetable, fixture list) — "a page with many implicit
  events." Its own source kind: parse rows → occurrences. **This is the weakest path
  and the most likely to need per-site tuning.** SFPL sidesteps it by giving every
  occurrence its own listing.

---

## Etiquette and legal

- Identify as `WhatsLocalBot/1.0` with a contact URL. Never spoof a browser UA to
  evade blocking.
- Honor `robots.txt` on both discovery and scraping.
- Rate-limit: ≤5 concurrent, backoff on 429/503.
- Sources are chosen by hand, not crawled from the open web — so each one is a
  judgment call a person made. Record the origin on the source row so it stays
  visible later.
- Some sites' terms prohibit automated collection regardless of `robots.txt`.

---

## Open questions

- **Descriptions.** 37 of 210 SFPL events have none. Import bare, skip, or generate?
  Leaning **import bare** — inventing descriptions for library events is how you
  publish something false.
- **How much filtering UI at confirm time** — source-native params where they exist
  (SFPL), post-extraction filtering where they don't.
- **JS-rendered calendars** — how often does it actually block us? Decide on headless
  only after real evidence.

---

## Files (planned, not yet built)

| path | role |
|---|---|
| `supabase/migrations/…_event_sources.sql` | `event_sources`, `event_source_runs`, `vendor_events` columns |
| `lib/calendar-discovery.ts` | URL → candidate calendars |
| `lib/calendar-recipe.ts` | derive + validate + roll back recipes |
| `lib/calendar-scrape.ts` | recipe → events (ICS / JSON-LD / LLM) → drafts |
| `lib/ics.ts` | minimal iCalendar parser (no dependency) |
| `lib/event-sources.ts` | CRUD, due-source query, run logging |
| `trigger/event-sources.ts` | on-demand task + daily sweep |
| `app/api/vendor/sources/*` | discover · create · list · run-now · pause · delete (`isAdmin`) |
| `components/admin/CalendarSources.tsx` | the Sourcing tab, live |

Harness used for the SFPL run (throwaway, not shipped): `sfpl_scrape.py` in the
session scratchpad — listing → quickview IDs → ICS → structured JSON.
