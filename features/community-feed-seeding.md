# Community feed seeding — making the feed alive without polluting it

Status: **spec, not built** (2026-08-13)

## The problem

Two of the three home surfaces are alive because they were seeded from reality.
Events pull from ten watched calendars (`lib/sources/registry.ts`, ~800 events).
The directory carries 400 real, geocoded, mostly-legacy businesses. Both provide
utility before a single user signs up.

The Feed tab got no such seed. It renders `posts` + vendor posts, and users have
to go first. So it's empty, and an empty feed is the surface that most makes the
app look abandoned — worse than a thin one, because it's the one place the
product promises other people.

This spec is how the feed gets seeded **without** becoming a news aggregator, an
ad for itself, or a junk drawer that suppresses the contribution it exists to
attract.

## The constraint that decides everything

**Whatever is in the feed teaches people what the feed is for.**

This is a stronger constraint than volume or cost, and it inverts the obvious
plan. Fill the feed with civic data and transit alerts and someone learns "this
is a local news app" — then never posts, not because they were crowded out, but
because posting about their morning into a data stream feels wrong.

So the seed must **look like the posts we want**, not like a feed of records.
Every ranking, source and voice decision below follows from that one sentence.

### Corollary: stakes, not logistics

The axis that separates good seed content from bad is **not** source type
(first-party vs scraped, ours vs press). It is:

- **Stakes** — something is at risk, something changed, something means
  something. → keep
- **Logistics** — something is merely useful. → cut

A Muni delay is logistics. An eviction is stakes. A street closure as a road
status is logistics; the same closure as *a thing to go to on Saturday* is
stakes.

Logistics is also **commodity**: Google Maps knows the closure, five apps know
the Muni delay. Nobody opens a new app for information they already have, so
those items cost permanent scraper maintenance and buy zero distinctiveness.
This one rule removes the two most fragile sources from the build.

## The stack

Top to bottom by priority. Everything below the fold **retreats** as the things
above it grow.

| # | Layer | Source | Notes |
|---|---|---|---|
| 1 | **User posts** | `posts` | The goal. Never outranked. |
| 2 | **Business announcements** | `posts` (vendor) | Real accounts, real posts. The content type we most want to grow. |
| 3 | **Directory activity** | our own DB | Zero scraping. See below. |
| 4 | **WhatsLocal house voice** | hand-written | The floor. Supersedes proximity. |
| 5 | **Neighborhood reporting** | civic records, written up | `WhatsLocal <Neighborhood>` byline. |
| 6 | **Stakes-filtered press** | RSS | Headline + link only. Never rewritten. |
| 7 | **Civic lines** | same records as 5 | Compact, no byline, only when 1–6 are thin. |

### 3 — Directory activity (do this first; it needs no scrapers)

Changes in data we already own. Near-zero cost, no external dependency, nothing
to maintain. It's just noticing a row changed:

- A business claimed their profile (`vendor_profiles`)
- A new business finished onboarding (QR booth / admin create)
- A vendor went live (`broadcasts`)
- An organizer published an event; a market lineup reached N vendors
- A confirmed community contribution (`community_contributions`)
- **Aggregates nobody else can compute** — *"three new food businesses opened
  within four blocks this month"*, *"eleven businesses on 24th are now on
  WhatsLocal, six on the legacy register"*

The aggregates are the most defensible content in the entire feed. They exist
only because the graph exists, and no publisher in SF can write them.

### 4 — WhatsLocal house voice (the floor)

Citywide, **supersedes proximity**, so a reader in a thin neighborhood still
opens to something with a pulse. It's also the only layer that can teach people
what to post.

**Do NOT auto-generate this nightly.** This is the one place the scraper
instinct is actively wrong: a model producing a fresh SF fun fact every night
yields 200 mediocre posts, and mediocre is worse here than anywhere else,
because this account *is* the brand voice. Write ~40 genuinely good ones, drip
them, refresh deliberately. Low volume, high craft — the opposite of the civic
pipeline.

Business-story posts may be **AI-drafted from real profile data**, but they pass
a human eye before publishing, at least until the voice is proven.

### The retreat rule

Auto content is **filler that yields**, not a fixed percentage:

1. Auto items **never take the top slot** when a human post exists in radius.
2. Once ≥3 real posts exist in the reader's radius today, layers 4–7 drop below
   them and the lowest-scoring ones **don't render at all**.
3. The feed gets less synthetic as it gets more alive, automatically, with
   nobody deciding when to turn it off.

Target ceiling: auto ≤ 40% of a rendered feed at launch, declining. A feed
that's persistently 40% brand content reads as an ad for itself.

### Visual separation

Auto items must **not** be dressed as user posts. People always clock it, and
the moment they do the whole feed reads as fake-populated. A distinct compact
card treatment is more honest and makes real posts feel *more* real by contrast.

## Accounts and identity

Two automated identities, both **visibly ours**:

- **`WhatsLocal`** — brand/editorial voice. Citywide. Mission, advocacy,
  business stories, norm-setting.
- **`WhatsLocal <Neighborhood>`** (e.g. `WhatsLocal Mission`) — reporting voice.
  Neutral, restrained, neighborhood-scoped.

Separating them lets the brand account have a stake in things while the
reporting one just reports, without either contaminating the other.

### Hard rules on identity

- **Never post AI-written content under a real person's account presented as
  their own experience.** A generated "grabbed a burrito at X, best in the city"
  is a fabricated endorsement with a real business's name in it, at scale, on a
  platform whose entire pitch is trust in local businesses. If discovered it
  costs not just the feed but the 400 businesses.
- **Never name the reporting account to imply independent press.**
  `WhatsLocal Mission`, not `Mission Wire`. The upside is negligible — nobody
  minds that a neighborhood account is run by an app — and the downside is the
  same trust problem in a smaller costume.
- **Never claim an experience nobody had.** Opinions about *experiences* are
  fine ("the pizza-tossing thing is either great or deeply embarrassing").
  Opinions rating a *business* are not.

Founders seeding their own network by hand is standard and fine. Using AI to
draft something **true**, published under a **named house account**, is no more
deceptive than using a scheduler. The line is fabricated first-person
experience, not automation.

## Voice rules

These are the generation prompt. They are what makes item #400 as good as item
#1.

1. **Every item is about a place or people, never a system.** Muni is a system.
   Liguria is a place. This single test kills most logistics content.
2. **Specificity is the voice.** "Since 1911." "By 11am." "38 businesses over 40
   years old." "3 to 1." Vagueness is what makes AI writing read as AI writing;
   the fix isn't better prose, it's a real number in nearly every post.
3. **The best house-voice posts hold two facts in tension.** Highest legacy
   density *and* second-highest vacancy. One fact is trivia; two facts in
   tension is a point of view.
4. **Never resolve tension the data can't resolve.** A building sale is not a
   closure. Restraint is what makes the account credible enough to be believed
   when something *is* dire.
5. **The ask is embedded, never appended.** "Go say something." "Tell us." No
   CTA blocks, no "download now".
6. **Opinions about experiences, never about businesses.** Nothing rates a
   business. Nothing claims to have eaten anywhere.

## Reference corpus — 24 approved examples

These are the calibration set: reviewed and approved 2026-08-13. Use them as
few-shot examples in generation and as the bar for review. Specifics are
illustrative.

### Mission

**1.** *(house voice — mission)*
> 41 businesses on 24th between Mission and Potrero have been here more than 30
> years. Nine have closed since 2020. That's the whole reason this app exists.

**2.** *(business story)*
> Casa Sanchez has been making tortillas on 24th since 1924. Third generation,
> same family, same block. They just claimed their profile — go say something.

**3.** *(permit × business graph)*
> The building La Palma Mexicatessen sits in filed for demolition review last
> week. La Palma's been there since 1953. Nothing's decided yet, but this is the
> stage where it usually gets decided.

**4.** *(directory aggregate)*
> Three new food businesses opened within four blocks of you this month. Two on
> Valencia, one on 22nd.

**5.** *(stakes press)*
> "Mission arts space wins reprieve from eviction" — Mission Local

**6.** *(house voice — norm-setting)*
> The most useful thing you can post here isn't a review. It's "this place is
> still open," "they changed their hours," "the new guy on Shotwell is good."
> Nobody else knows that but you.

**7.** *(contested agenda)*
> Supes vote Tuesday on whether the Valencia bike lane stays. It's item 14.
> Public comment at 2, and it's the kind of thing that gets decided by whoever
> shows up.

**8.** *(house voice — fact with stakes)*
> A "legacy business" in SF has to prove 30 years of continuous operation and
> that losing it would hurt the neighborhood. 400 have made the register. There
> are more that never applied.

**9.** *(directory aggregate)*
> Eleven businesses on 24th are now on WhatsLocal. Six of them are on the legacy
> register.

**10.** *(event, written as a thing to do — not a road status)*
> Sunday Streets is on Mission this Saturday, 16th to 19th, 9 to 6. Get the
> churros before 11 — they go.

**11.** *(house voice — advocacy)*
> Rent on 24th went up 60% in a decade. The businesses that survived it mostly
> did it by owning their building or having a landlord who didn't. There's no
> third way, which is the problem.

**12.** *(stakes press)*
> "Beloved Valencia bookstore to close after 34 years" — SF Standard

### North Beach

**13.** *(business story)*
> Liguria Bakery has made focaccia and nothing else since 1911. They close when
> they sell out, which is usually by 11am. Four generations have decided that's
> enough.

**14.** *(house voice — advocacy)*
> North Beach has 38 businesses over 40 years old — the highest density in the
> city. It also has the second-highest commercial vacancy rate. Both of those
> things are true at once and that's the story of this neighborhood.

**15.** *(records × business graph — deliberately restrained)*
> The Columbus Ave building housing three ground-floor businesses changed hands
> last month. New ownership doesn't mean anything by itself. It's just the
> moment worth noticing.

**16.** *(business post — second-party, for contrast)*
> **Caffe Trieste:** Sunday opera is back starting this weekend. Same as it's
> been since 1971. Free, obviously.

**17.** *(directory aggregate)*
> Four businesses on Grant between Columbus and Green have joined WhatsLocal
> this month. Three predate 1980.

**18.** *(house voice — norm-setting)*
> Post the thing you'd tell a friend, not the thing you'd write in a review.
> "They're cash only." "Go before noon." "The owner's name is Rosa and she'll
> remember you." That's what nobody can Google.

**19.** *(stakes press)*
> "City Lights launches emergency fundraiser as sales fall" — SF Chronicle

**20.** *(contested agenda)*
> Planning commission hears the Broadway upzoning proposal Thursday. It affects
> height limits on eleven blocks. Nobody from the neighborhood has filed comment
> yet.

**21.** *(house voice — mission)*
> A third of the Italian businesses that defined this neighborhood in 1990 are
> gone. What replaced most of them wasn't a chain — it was nothing. Empty
> storefronts outnumber new arrivals here 3 to 1.

**22.** *(directory activity)*
> Molinari Delicatessen just claimed their profile. On Columbus since 1896 — the
> oldest continuously operating business in the neighborhood.

**23.** *(event, with a voice)*
> North Beach Festival is June 14–15. Grant and Green close, 90-odd vendors, and
> the pizza-tossing thing that's either great or deeply embarrassing depending
> on your tolerance.

**24.** *(at-risk detection, turned into a request)*
> We've noticed six businesses in this neighborhood haven't updated anything in
> over a year. Some closed quietly. If you know which, tell us — that's a real
> service to everyone else on this block.

**Why #24 is shaped that way:** a business going quiet is a genuinely useful
signal, but asserting "X has closed" from an absence of data will eventually be
wrong about a real business in a way that harms them. Turning the detection into
a request is the safest version, and it doubles as norm-setting.

## Sources

Six, ordered by value-per-maintenance. **Every source is a permanent
maintenance obligation** — prefer government APIs and RSS over hand-written
selectors. (`downtownsf` is the cautionary example: the one source parsed with
hand-written selectors is the one whose 41 events had to be held back as
drafts.)

| Source | Layer | Stability | Notes |
|---|---|---|---|
| **Our own DB** | 3 | permanent | No scraper. Ships first. |
| **Hand-written house voice** | 4 | permanent | No scraper. Ships first. |
| **Stakes-filtered press RSS** | 6 | high | Mission Local, SF Standard, SFist, Hoodline, Eater SF, KQED. Headline + link **only**. |
| **DataSF permits (Planning/DBI)** | 5 | high | **Only when joined to a business we know.** A filing at an arbitrary address is noise; a filing on the building housing a 70-year-old business is a story. The join *is* the value. |
| **Legistar agendas** | 5 | medium | Board of Supes + commissions. **Only when contested.** Low volume, high stakes. |
| **Special-event permits** | 5 | medium | Only the ones that are *events* (Sunday Streets), never road status. |

### Explicitly cut

- **SFMTA service alerts** — commodity logistics, permanent scraper.
- **Generic street closures** — road status is Google's job.
- **311** — huge volume, near-zero interesting content. Only pattern-level
  aggregates would ever qualify and they don't justify the ingest.
- **Full-text press ingestion** — copyright exposure, and an App-Store-visible
  content surface with a real complainant. Headline + link is settled practice;
  AI-rewriting an article is both the derivative-work argument and a
  hallucination-with-a-byline risk on civic information.

## Schema

**A new table, never `posts`.** Two reasons, both load-bearing:

1. A retention sweep over auto content must be structurally incapable of
   touching a user's post. That's the failure you cannot recover from.
2. Dedupe on re-ingest needs `(source_id, external_uid)` unique — the same
   pattern `vendor_events` already uses for scraped events.

```sql
create table feed_items (
  id            uuid primary key default gen_random_uuid(),

  -- 'house' | 'neighborhood' | 'directory' | 'press' | 'civic'
  layer         text not null,
  -- 'whatslocal' | 'whatslocal_<hood>' — the visible byline
  account       text not null,

  body          text not null,
  link_url      text,          -- press: the article. directory: the profile.
  link_label    text,          -- "Mission Local", "see profile"

  -- Placement. NULL neighborhood = citywide (house voice supersedes proximity).
  neighborhood  text,
  lat           double precision,
  lng           double precision,

  -- Ranking inputs
  stakes        smallint not null default 3,   -- 1..5, set at ingest
  embedding     vector(1536),                  -- personalisation; nullable
  embed_model   text,

  -- Lifecycle
  published_at  timestamptz not null default now(),
  expires_at    timestamptz,                   -- relevance, not storage
  hidden_at     timestamptz,                   -- soft; reversible
  reviewed_at   timestamptz,                   -- house voice: human-approved

  -- Dedupe on re-ingest
  source_id     text,
  external_uid  text,
  unique (source_id, external_uid)
);
```

Notes:

- **`unique (source_id, external_uid)` must not be partial** — `ON CONFLICT`
  cannot use a partial index. Same bug already fixed once in
  `20260804130000_scraped_events_conflict_target.sql`.
- **No ivfflat/hnsw index on `embedding`**, matching `vendor_events`:
  similarity is one weighted signal among several, so every candidate needs a
  score. A top-K ANN would silently override proximity and stakes.
- **Grants:** service-role write. Read grant to `anon` is fine (this content is
  public by construction), unlike `shopper_taste`.

### Rendering

Add a `FeedItemBase` variant in `lib/demo-feed.ts`:

```ts
export type AutoFeedItem = FeedItemBase & {
  kind: "auto";
  layer: "house" | "neighborhood" | "directory" | "press" | "civic";
  body: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  neighborhood?: string | null;
  miles?: number | null;
  stakes: number;
};
```

New `components/feed/AutoFeedCard.tsx` — compact, visually distinct from
`CommunityPostCard`. `CommunityFeed.tsx` merges it into the existing sort. Fetch
through a shared SWR hook in `lib/data-hooks.ts` (`useFeedItems`) — **never a
raw `useEffect` + `fetch`**, per the house convention.

## Ranking

Not radius tiers — **stakes × proximity decay**, which gets radius expansion for
free and behaves correctly at the edges:

- small thing, one block → surfaces
- small thing, across the city → never surfaces
- **big thing, across the city → surfaces above your block-level items**

That last case is why tiers are wrong: if a landmark burns down in North Beach,
a strict distance ladder buries it under a permit on your street.

```
score = stakes_weight(stakes)
      × proximity_decay(miles)      // 1.0 at 0mi, decaying; house voice = 1.0 always
      × freshness_decay(age)
      × (1 + similarity_bonus)      // shopper_taste embedding, when present
      × layer_weight(layer)         // enforces the stack
      × retreat_factor(real_posts_in_radius_today)
```

Reuse what exists:

- `lib/proximity.ts` `milesTo` / `byDistance`. **A record with no coords never
  shows a distance and never ranks as if nearby** — same rule as everywhere else.
- `lib/reco/rank.ts` weighting shape, and `shopper_taste` +
  `event_similarity()`-style SQL similarity for personalisation. Similarity is
  computed **in SQL**; vectors never leave Postgres.

Two rules that keep expansion honest:

1. **Show the distance on every item** — "3 blocks" / "Bernal Heights" /
   "Citywide". Costs nothing; it's the difference between feeling tuned and
   feeling padded.
2. **Stop rather than pad.** Set a quality floor and let a slow day be short.
   Six great items beats six great items plus fourteen potholes, and a feed
   that's sometimes short is a feed people trust — the length carries
   information.

## Neighborhoods

DataSF publishes **41 Analysis Neighborhoods** as GeoJSON. Ship it as a static
file + point-in-polygon (`lib/neighborhoods.ts`).

- **Do not reverse-geocode per item** — `/api/places/reverse` is billed and
  auth-gated for exactly that reason (`lib/places.ts` spending rules).
- **Do not use free-text labels** — the same rejection already recorded for post
  coordinates: a district centroid printed as an item's spot is worse than no
  spot.
- Assign at ingest, once, never on a read path.

## Retention

**Storage is not the problem.** ~100 auto items/day × 12 neighborhoods ≈ 36k
rows/year; a few hundred MB with embeddings, most of that the vectors. Cheap.

**Pollution is the problem.** A March street closure sitting in the feed in
August is worse than an empty feed — it's proof nobody's minding the shop.

So `expires_at` is a **relevance** rule set per item at ingest:

| Layer | Lifespan |
|---|---|
| civic line | hours–days |
| event/closure | until it happens |
| press | ~7 days |
| permit/agenda story | ~14 days |
| directory activity | ~30 days |
| business story / house voice | evergreen; may resurface |

Expired items are **hidden, not hard-deleted**, for 90 days, so a bad rule is
reversible. Hard-delete after that. The sweep touches `feed_items` only —
structurally incapable of reaching `posts`.

## Cost

Anchored on a measured number: labelling 800 events cost ~$0.11, ≈$0.00014/item.

- ~100–200 items/day reach a model after rule-based prefiltering → **a few cents
  a day, ~$1–2/month.**
- Embedding is cheaper still.
- **The model runs once per new item, never per request.** Generation happens in
  the sweep; the sentence is stored; every reader after that is a plain DB read.
  Break this — score at read time, personalise by re-running the model — and it
  stops being a rounding error.
- **Filter before the model, not with it.** Deterministic rules kill the
  firehose (category, address, dedupe) at zero cost; the model only sees
  survivors and only does the cheap job: is this interesting, and say it in one
  sentence.

**The real cost is maintenance**, and it's engineering time. Four scrapers means
four things that break silently. The events sweep already failed every night for
weeks unnoticed (Trigger.dev prod env vars unset + a Node runtime with no
WebSocket). This needs a **staleness alarm from day one** — a stale feed is more
visibly broken than a stale calendar, because a top item dated nine days ago
reads as an abandoned app.

## Phasing

**Phase 1 — no scrapers at all.** Migration + `AutoFeedCard` + ranking +
neighborhoods + directory activity (layer 3) + ~40 hand-written house-voice
posts (layer 4). This alone carries a feed, has zero maintenance surface, is
entirely first-party, and is the highest-signal content in the whole spec. Ship
and live with it before adding a single source.

**Phase 2 — press RSS** (layer 6), stakes-filtered. Cheapest possible ingest,
highest stability, immediately widens coverage.

**Phase 3 — permits × business graph** (layer 5). The genuinely differentiated
one, and the reason to have built the graph. Requires the address join.

**Phase 4 — contested agendas** (layer 5), if 1–3 have proven the loop.

Wire into `trigger/event-sources.ts` as an additional task beside
`sweepEventSourcesTask`, reusing the `SourceDef`/registry pattern. Kill switch
mirrors `scripts/publish-events.ts --hide`: one flag, ~1s, no deploy.

## Failure modes

- **The feed defines itself as a news app.** Mitigated by phasing (first-party
  first), the retreat rule, and voice rules 1 and 5. Watch for: users reading
  and never posting.
- **Auto content suppresses contribution.** If real posts don't appear within
  ~6 weeks in a seeded neighborhood, the seed is crowding, not scaffolding.
  Reduce the ceiling before adding sources.
- **A scraper dies silently.** Staleness alarm, per-source, day one.
- **House voice goes stale.** 40 posts at ~3/week is ~3 months. Calendar the
  refresh; don't let a generator paper over it.
- **We assert something untrue about a real business.** Voice rule 4 and the
  shape of example #24 are the defenses. Anything derived from an *absence* of
  data is a question, never a claim.

## Open questions

1. Is the neighborhood cut what readers actually want, or was it a way to make
   citywide content feel personal? Phase 1 answers this cheaply — house voice is
   citywide, directory activity is local; compare engagement.
2. Does a resident want the logistics we cut (Muni, closures)? If so it likely
   belongs on a **separate utility surface**, not the feed — mixing logistics
   into the feed is what makes a feed read as a dashboard.
3. Should auto items be repliable/reactable? Argument for: repliability is what
   makes an item social rather than broadcast, and it's the on-ramp to posting.
   Argument against: it puts moderation surface on content we authored. Leaning
   yes, routed through `lib/ai-moderation.ts` like everything else.
4. How many neighborhoods at launch? Probably one (Mission — highest business
   density), proven, then widened.
